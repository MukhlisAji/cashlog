import { householdRepository } from "../household/household.repository.js";
import type { Env } from "../../config/env.js";
import { MetaService } from "./meta-cloud.service.js";

let metaService: MetaService | null = null;

export function initMetaOutbound(env: Env): MetaService {
  metaService = new MetaService(env);
  return metaService;
}

export function getMetaService(): MetaService {
  if (!metaService) {
    throw new Error("Meta WhatsApp service is not initialized");
  }
  return metaService;
}

async function householdOutboundPhones(
  userId: string,
  includeMembers: boolean,
): Promise<{ lead: string | null; phones: string[] }> {
  const lead = await householdRepository.getLeadPhone(userId);
  const phones: string[] = [];
  if (lead) phones.push(lead);
  if (includeMembers) {
    const members = await householdRepository.listActiveMemberPhones(userId);
    for (const phone of members) {
      if (!phones.includes(phone)) phones.push(phone);
    }
  }
  return { lead, phones };
}

export async function sendTextToLeadUser(
  userId: string,
  text: string,
): Promise<boolean> {
  return sendTextToHousehold(userId, text, false);
}

export async function sendTextToHousehold(
  userId: string,
  text: string,
  includeMembers: boolean,
): Promise<boolean> {
  const { lead, phones } = await householdOutboundPhones(userId, includeMembers);
  if (!lead || phones.length === 0) return false;

  let leadOk = false;
  for (const phone of phones) {
    try {
      await getMetaService().sendWhatsAppMessage(phone, text);
      if (phone === lead) leadOk = true;
    } catch (error) {
      console.error({ userId, phone, error }, "[meta-outbound] send text failed");
    }
  }
  return leadOk;
}

export async function sendDocumentToLeadUser(
  userId: string,
  pdf: Buffer,
  filename: string,
  caption: string,
): Promise<boolean> {
  return sendDocumentToHousehold(userId, pdf, filename, caption, false);
}

export async function sendDocumentToHousehold(
  userId: string,
  pdf: Buffer,
  filename: string,
  caption: string,
  includeMembers: boolean,
): Promise<boolean> {
  const { lead, phones } = await householdOutboundPhones(userId, includeMembers);
  if (!lead || phones.length === 0) return false;

  let leadOk = false;
  for (const phone of phones) {
    try {
      await getMetaService().sendDocument(phone, pdf, filename, caption);
      if (phone === lead) leadOk = true;
    } catch (error) {
      console.error(
        { userId, phone, error },
        "[meta-outbound] send document failed",
      );
    }
  }
  return leadOk;
}
