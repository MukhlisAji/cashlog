import type { Env } from "../../config/env.js";
import {
  categoriesRepository,
  googleConnectionRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import {
  buildCreateSpreadsheetRequest,
  populateSheetTemplate,
} from "./sheet-template.service.js";
import { getSheetsClient } from "./google-client.js";

export async function setupGoogleSheet(env: Env, userId: string) {
  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.refresh_token) {
    throw new Error("Google not connected");
  }

  if (connection.spreadsheet_id) {
    return {
      spreadsheetId: connection.spreadsheet_id,
      spreadsheetUrl: connection.spreadsheet_url!,
      alreadyExists: true,
    };
  }

  const sheets = await getSheetsClient(env, userId);
  const year = String(new Date().getFullYear());

  const created = await sheets.spreadsheets.create({
    requestBody: buildCreateSpreadsheetRequest(year),
  });

  const spreadsheetId = created.data.spreadsheetId!;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  await populateSheetTemplate(sheets, spreadsheetId, year);

  await googleConnectionRepository.updateSpreadsheet(
    userId,
    spreadsheetId,
    spreadsheetUrl,
  );

  await userConfigRepository.ensure(userId);
  await categoriesRepository.seedDefaults(userId);

  return { spreadsheetId, spreadsheetUrl, alreadyExists: false };
}

export async function getSheetStatus(userId: string) {
  const connection = await googleConnectionRepository.getByUserId(userId);
  return {
    connected: !!connection?.refresh_token,
    spreadsheetId: connection?.spreadsheet_id ?? null,
    spreadsheetUrl: connection?.spreadsheet_url ?? null,
  };
}
