export type HouseholdMemberRole = "lead" | "member";

export type HouseholdMemberStatus = "active" | "revoked";

export interface HouseholdRow {
  id: string;
  lead_user_id: string;
  member_slots_paid: number;
}

export interface HouseholdMemberRow {
  id: string;
  household_id: string;
  role: HouseholdMemberRole;
  display_name: string;
  phone_number: string | null;
  status: HouseholdMemberStatus;
}

export interface MessageContext {
  memberId: string;
  leadUserId: string;
  displayName: string;
  role: HouseholdMemberRole;
  isLead: boolean;
  phoneNumber: string | null;
}
