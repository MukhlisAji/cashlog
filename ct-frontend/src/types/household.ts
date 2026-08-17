export type HouseholdMemberStatus = "active" | "revoked";

export interface HouseholdMember {
  id: string;
  displayName: string;
  phone: string | null;
  status: HouseholdMemberStatus;
}

export interface HouseholdSummary {
  householdId: string;
  leadPhone?: string | null;
  memberSlotsPaid: number;
  memberSlotsMax: number;
  activeMemberCount: number;
  memberPrice: number;
  canManageHousehold: boolean;
  canInviteMember: boolean;
  members: HouseholdMember[];
}
