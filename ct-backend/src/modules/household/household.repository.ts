import { randomUUID } from "node:crypto";

import { getSupabaseAdmin } from "../../lib/supabase.js";
import { normalizePhone } from "../whatsapp/whatsapp.utils.js";
import type {
  HouseholdMemberRow,
  HouseholdMemberStatus,
  HouseholdRow,
  MessageContext,
} from "./household.types.js";

function sb() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error("Supabase is not configured");
  }
  return client;
}

function mapHousehold(row: Record<string, unknown>): HouseholdRow {
  return {
    id: String(row.id),
    lead_user_id: String(row.lead_user_id),
    member_slots_paid: Number(row.member_slots_paid ?? 0),
    notify_members_reminder: row.notify_members_reminder !== false,
    notify_members_weekly: row.notify_members_weekly === true,
    notify_members_monthly: row.notify_members_monthly === true,
    habit_streak: Number(row.habit_streak ?? 0),
    habit_last_date: row.habit_last_date
      ? String(row.habit_last_date).slice(0, 10)
      : null,
  };
}

function mapMember(row: Record<string, unknown>): HouseholdMemberRow {
  return {
    id: String(row.id),
    household_id: String(row.household_id),
    role: row.role === "lead" ? "lead" : "member",
    display_name: String(row.display_name),
    phone_number: (row.phone_number as string | null) ?? null,
    status: row.status === "revoked" ? "revoked" : "active",
  };
}

export const householdRepository = {
  async ensureHousehold(
    leadUserId: string,
    leadDisplayName = "Pemilik",
    leadPhone: string | null = null,
  ): Promise<HouseholdRow> {
    const client = sb();

    const { error: hhErr } = await client.from("households").upsert(
      { id: leadUserId, lead_user_id: leadUserId },
      { onConflict: "id" },
    );
    if (hhErr) throw hhErr;

    const { data: existingLead, error: leadSelErr } = await client
      .from("household_members")
      .select("id")
      .eq("household_id", leadUserId)
      .eq("role", "lead")
      .maybeSingle();
    if (leadSelErr) throw leadSelErr;

    if (!existingLead) {
      const { error: leadInsErr } = await client.from("household_members").insert({
        id: leadUserId,
        household_id: leadUserId,
        role: "lead",
        display_name: leadDisplayName,
        phone_number: leadPhone,
        status: "active",
      });
      if (leadInsErr) throw leadInsErr;
    } else if (leadPhone) {
      const { error: leadSyncErr } = await client
        .from("household_members")
        .update({ phone_number: leadPhone, updated_at: new Date().toISOString() })
        .eq("id", leadUserId)
        .is("phone_number", null);
      if (leadSyncErr) throw leadSyncErr;
    }

    const household = await this.getByLeadUserId(leadUserId);
    if (!household) {
      throw new Error("Failed to ensure household");
    }
    return household;
  },

  async getByLeadUserId(leadUserId: string): Promise<HouseholdRow | null> {
    const { data, error } = await sb()
      .from("households")
      .select("*")
      .eq("lead_user_id", leadUserId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapHousehold(data as Record<string, unknown>) : null;
  },

  async getMemberById(memberId: string): Promise<HouseholdMemberRow | null> {
    const { data, error } = await sb()
      .from("household_members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapMember(data as Record<string, unknown>) : null;
  },

  async getActiveByPhone(phone: string): Promise<MessageContext | null> {
    const normalized = normalizePhone(phone);

    const { data, error } = await sb()
      .from("household_members")
      .select("id, role, display_name, phone_number, household_id, status")
      .eq("phone_number", normalized)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        memberId: String(data.id),
        leadUserId: String(data.household_id),
        displayName: String(data.display_name),
        role: data.role === "lead" ? "lead" : "member",
        isLead: data.role === "lead",
        phoneNumber: (data.phone_number as string | null) ?? normalized,
      };
    }

    // Solo user: phone on profiles is enough — household add-on not required.
    const { data: profile, error: profileErr } = await sb()
      .from("profiles")
      .select("id, full_name, phone_number")
      .eq("phone_number", normalized)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile?.phone_number) return null;

    return {
      memberId: String(profile.id),
      leadUserId: String(profile.id),
      displayName: String(profile.full_name ?? "Pemilik"),
      role: "lead",
      isLead: true,
      phoneNumber: normalized,
    };
  },

  async listMembers(householdId: string): Promise<HouseholdMemberRow[]> {
    const { data, error } = await sb()
      .from("household_members")
      .select("*")
      .eq("household_id", householdId)
      .eq("role", "member")
      .neq("status", "revoked")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapMember(row as Record<string, unknown>));
  },

  async countActiveMemberSlots(householdId: string): Promise<number> {
    const { count, error } = await sb()
      .from("household_members")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("role", "member")
      .neq("status", "revoked");
    if (error) throw error;
    return count ?? 0;
  },

  async isPhoneUsedElsewhere(
    phone: string,
    excludeMemberId?: string,
  ): Promise<boolean> {
    let query = sb()
      .from("household_members")
      .select("id")
      .eq("phone_number", phone)
      .eq("status", "active")
      .limit(1);

    if (excludeMemberId) {
      query = query.neq("id", excludeMemberId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (data) return true;

    const { data: profile, error: profileErr } = await sb()
      .from("profiles")
      .select("id")
      .eq("phone_number", phone)
      .limit(1)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (profile && profile.id !== excludeMemberId) return true;

    return false;
  },

  async createWhitelistedMember(
    householdId: string,
    displayName: string,
    phone: string,
  ): Promise<string> {
    const memberId = randomUUID();
    const { error } = await sb().from("household_members").insert({
      id: memberId,
      household_id: householdId,
      role: "member",
      display_name: displayName,
      phone_number: phone,
      status: "active",
    });
    if (error) throw error;
    return memberId;
  },

  async updateMember(
    memberId: string,
    data: {
      status?: HouseholdMemberStatus;
      phone_number?: string | null;
      display_name?: string;
    },
  ): Promise<void> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status !== undefined) patch.status = data.status;
    if (data.phone_number !== undefined) patch.phone_number = data.phone_number;
    if (data.display_name !== undefined) patch.display_name = data.display_name;

    const { error } = await sb()
      .from("household_members")
      .update(patch)
      .eq("id", memberId);
    if (error) throw error;
  },

  async setLeadPhone(leadUserId: string, phone: string): Promise<void> {
    await this.ensureHousehold(leadUserId, "Pemilik", phone);

    await this.updateMember(leadUserId, {
      status: "active",
      phone_number: phone,
    });

    const { error } = await sb()
      .from("profiles")
      .update({ phone_number: phone, updated_at: new Date().toISOString() })
      .eq("id", leadUserId);
    if (error) throw error;
  },

  async getLeadPhone(leadUserId: string): Promise<string | null> {
    const member = await this.getMemberById(leadUserId);
    if (member?.phone_number) return member.phone_number;

    const { data, error } = await sb()
      .from("profiles")
      .select("phone_number")
      .eq("id", leadUserId)
      .maybeSingle();
    if (error) throw error;
    return (data?.phone_number as string | null) ?? null;
  },

  async revokeMember(memberId: string): Promise<void> {
    await this.updateMember(memberId, {
      status: "revoked",
      phone_number: null,
    });
  },

  async setMemberSlotsPaid(householdId: string, slots: number): Promise<void> {
    const { error } = await sb()
      .from("households")
      .update({
        member_slots_paid: slots,
        updated_at: new Date().toISOString(),
      })
      .eq("id", householdId);
    if (error) throw error;
  },

  async setHabitStreak(
    householdId: string,
    streak: number,
    lastDate: string,
  ): Promise<void> {
    const { error } = await sb()
      .from("households")
      .update({
        habit_streak: streak,
        habit_last_date: lastDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", householdId);
    if (error) throw error;
  },

  async updateMemberNotifyFlags(
    householdId: string,
    flags: {
      notify_members_reminder?: boolean;
      notify_members_weekly?: boolean;
      notify_members_monthly?: boolean;
    },
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (flags.notify_members_reminder !== undefined) {
      patch.notify_members_reminder = flags.notify_members_reminder;
    }
    if (flags.notify_members_weekly !== undefined) {
      patch.notify_members_weekly = flags.notify_members_weekly;
    }
    if (flags.notify_members_monthly !== undefined) {
      patch.notify_members_monthly = flags.notify_members_monthly;
    }

    const { error } = await sb()
      .from("households")
      .update(patch)
      .eq("id", householdId);
    if (error) throw error;
  },

  async listActiveMemberPhones(householdId: string): Promise<string[]> {
    const members = await this.listMembers(householdId);
    return members
      .map((m) => m.phone_number)
      .filter((phone): phone is string => Boolean(phone));
  },

  async listLeadUserIdsWithPhone(): Promise<string[]> {
    const { data, error } = await sb()
      .from("household_members")
      .select("household_id")
      .eq("role", "lead")
      .eq("status", "active")
      .not("phone_number", "is", null);
    if (error) throw error;
    return [...new Set((data ?? []).map((row) => String(row.household_id)))];
  },

  async resolveMessageContext(memberId: string): Promise<MessageContext | null> {
    const { data, error } = await sb()
      .from("household_members")
      .select("id, role, display_name, phone_number, household_id, status")
      .eq("id", memberId)
      .neq("status", "revoked")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      memberId: String(data.id),
      leadUserId: String(data.household_id),
      displayName: String(data.display_name),
      role: data.role === "lead" ? "lead" : "member",
      isLead: data.role === "lead",
      phoneNumber: (data.phone_number as string | null) ?? null,
    };
  },
};
