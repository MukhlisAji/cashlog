import type { Env } from "../../config/env.js";
import { householdRepository } from "../household/household.repository.js";
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

export async function sendTextToLeadUser(
  userId: string,
  text: string,
): Promise<boolean> {
  const phone = await householdRepository.getLeadPhone(userId);
  if (!phone) return false;
  try {
    await getMetaService().sendWhatsAppMessage(phone, text);
    return true;
  } catch (error) {
    console.error({ userId, error }, "[meta-outbound] send text failed");
    return false;
  }
}

export async function sendDocumentToLeadUser(
  userId: string,
  pdf: Buffer,
  filename: string,
  caption: string,
): Promise<boolean> {
  const phone = await householdRepository.getLeadPhone(userId);
  if (!phone) return false;
  try {
    await getMetaService().sendDocument(phone, pdf, filename, caption);
    return true;
  } catch (error) {
    console.error({ userId, error }, "[meta-outbound] send document failed");
    return false;
  }
}
