import type { Env } from "../../config/env.js";
import { checkSubscription } from "../../lib/subscription.js";
import { getUserProfile } from "../../lib/subscription.js";
import { householdRepository } from "./household.repository.js";

export async function ensureLeadHousehold(leadUserId: string) {
  const profile = await getUserProfile(leadUserId);
  const name =
    profile?.full_name?.trim() ||
    profile?.email?.split("@")[0] ||
    "Pemilik";
  return householdRepository.ensureHousehold(
    leadUserId,
    name,
    profile?.phone_number ?? null,
  );
}

export async function getHouseholdSummary(leadUserId: string, env: Env) {
  const household = await ensureLeadHousehold(leadUserId);
  const sub = await checkSubscription(leadUserId);
  const members = await householdRepository.listMembers(household.id);
  const activeCount = await householdRepository.countActiveMemberSlots(
    household.id,
  );
  const leadPhone = await householdRepository.getLeadPhone(leadUserId);

  const maxSlots = env.MAX_HOUSEHOLD_MEMBER_SLOTS;
  const slotsPaid = household.member_slots_paid;
  const memberPrice = env.HOUSEHOLD_MEMBER_PRICE;

  return {
    householdId: household.id,
    leadPhone,
    memberSlotsPaid: slotsPaid,
    memberSlotsMax: maxSlots,
    activeMemberCount: activeCount,
    memberPrice,
    canManageHousehold: sub.canManageHousehold,
    canInviteMember:
      sub.canManageHousehold &&
      slotsPaid > 0 &&
      activeCount < slotsPaid &&
      activeCount < maxSlots,
    notifyMembersReminder: household.notify_members_reminder,
    notifyMembersWeekly: household.notify_members_weekly,
    notifyMembersMonthly: household.notify_members_monthly,
    members: members.map((m) => ({
      id: m.id,
      displayName: m.display_name,
      phone: m.phone_number,
      status: m.status,
    })),
  };
}

export async function updateMemberNotifyFlags(
  leadUserId: string,
  flags: {
    notifyMembersReminder?: boolean;
    notifyMembersWeekly?: boolean;
    notifyMembersMonthly?: boolean;
  },
) {
  const sub = await checkSubscription(leadUserId);
  if (!sub.canManageHousehold) {
    return {
      ok: false as const,
      error: "Pengaturan notifikasi anggota hanya untuk langganan Pro.",
    };
  }

  const household = await ensureLeadHousehold(leadUserId);
  await householdRepository.updateMemberNotifyFlags(household.id, {
    notify_members_reminder: flags.notifyMembersReminder,
    notify_members_weekly: flags.notifyMembersWeekly,
    notify_members_monthly: flags.notifyMembersMonthly,
  });

  const updated = await householdRepository.getByLeadUserId(leadUserId);
  return {
    ok: true as const,
    data: {
      notifyMembersReminder: updated?.notify_members_reminder ?? true,
      notifyMembersWeekly: updated?.notify_members_weekly ?? false,
      notifyMembersMonthly: updated?.notify_members_monthly ?? false,
    },
  };
}

export async function addWhitelistedMember(
  env: Env,
  leadUserId: string,
  displayName: string,
  phone: string,
) {
  const sub = await checkSubscription(leadUserId);
  if (!sub.canManageHousehold) {
    return {
      ok: false as const,
      error: "Fitur keluarga hanya untuk langganan Pro.",
    };
  }

  const household = await ensureLeadHousehold(leadUserId);
  const activeCount = await householdRepository.countActiveMemberSlots(
    household.id,
  );

  if (household.member_slots_paid <= 0) {
    return {
      ok: false as const,
      error: "Beli slot anggota keluarga dulu di pengaturan.",
    };
  }

  if (activeCount >= household.member_slots_paid) {
    return {
      ok: false as const,
      error: "Semua slot anggota sudah terpakai. Cabut anggota atau tambah slot.",
    };
  }

  if (activeCount >= env.MAX_HOUSEHOLD_MEMBER_SLOTS) {
    return {
      ok: false as const,
      error: `Maksimal ${env.MAX_HOUSEHOLD_MEMBER_SLOTS} anggota keluarga.`,
    };
  }

  const trimmed = displayName.trim();
  if (trimmed.length < 2) {
    return { ok: false as const, error: "Nama anggota minimal 2 karakter." };
  }

  if (await householdRepository.isPhoneUsedElsewhere(phone)) {
    return {
      ok: false as const,
      error: "Nomor ini sudah terdaftar di akun cashlog.id lain.",
    };
  }

  const memberId = await householdRepository.createWhitelistedMember(
    household.id,
    trimmed,
    phone,
  );

  return {
    ok: true as const,
    data: {
      memberId,
      displayName: trimmed,
      phone,
    },
  };
}

export async function setLeadWhatsAppPhone(leadUserId: string, phone: string) {
  await ensureLeadHousehold(leadUserId);

  if (await householdRepository.isPhoneUsedElsewhere(phone, leadUserId)) {
    return {
      ok: false as const,
      error: "Nomor ini sudah terdaftar di akun cashlog.id lain.",
    };
  }

  await householdRepository.setLeadPhone(leadUserId, phone);
  return { ok: true as const, data: { phone } };
}

export async function purchaseMemberSlots(
  leadUserId: string,
  slots: number,
  env: Env,
) {
  const sub = await checkSubscription(leadUserId);
  if (!sub.canManageHousehold) {
    return {
      ok: false as const,
      error: "Slot anggota keluarga hanya untuk langganan Pro.",
    };
  }

  const max = env.MAX_HOUSEHOLD_MEMBER_SLOTS;
  if (!Number.isInteger(slots) || slots < 0 || slots > max) {
    return {
      ok: false as const,
      error: `Jumlah slot harus 0–${max}.`,
    };
  }

  const household = await ensureLeadHousehold(leadUserId);
  const activeCount = await householdRepository.countActiveMemberSlots(
    household.id,
  );

  if (slots < activeCount) {
    return {
      ok: false as const,
      error: `Masih ada ${activeCount} anggota aktif. Cabut dulu sebelum kurangi slot.`,
    };
  }

  await householdRepository.setMemberSlotsPaid(household.id, slots);

  return {
    ok: true as const,
    data: {
      memberSlotsPaid: slots,
      amount: slots * env.HOUSEHOLD_MEMBER_PRICE,
    },
  };
}
