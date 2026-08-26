import type { Env } from "../../config/env.js";
import {
  categoriesRepository,
  googleConnectionRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import { getDriveClient, getSheetsClient, hasDriveFileScope } from "./google-client.js";
import {
  GoogleScopeMissingError,
  isGoogleInsufficientScopeError,
} from "./google-scope.js";
import {
  ensureAppSpreadsheetTabs,
  populateSheetTemplate,
} from "./sheet-template.service.js";
import { SHEET_TITLE } from "./sheets.constants.js";

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

  const driveOk = await hasDriveFileScope(env, userId);
  if (!driveOk) {
    throw new GoogleScopeMissingError();
  }

  try {
    const drive = await getDriveClient(env, userId);
    const sheets = await getSheetsClient(env, userId);
    const year = String(new Date().getFullYear());

    const created = await drive.files.create({
      requestBody: {
        name: SHEET_TITLE,
        mimeType: "application/vnd.google-apps.spreadsheet",
      },
      fields: "id, webViewLink",
    });

    const spreadsheetId = created.data.id;
    if (!spreadsheetId) {
      throw new Error("Google Drive did not return a spreadsheet id");
    }

    const spreadsheetUrl =
      created.data.webViewLink ??
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    await ensureAppSpreadsheetTabs(sheets, spreadsheetId, year);
    await populateSheetTemplate(sheets, spreadsheetId, year);

    await googleConnectionRepository.updateSpreadsheet(
      userId,
      spreadsheetId,
      spreadsheetUrl,
    );

    await userConfigRepository.ensure(userId);
    await categoriesRepository.seedDefaults(userId);

    return { spreadsheetId, spreadsheetUrl, alreadyExists: false };
  } catch (error) {
    if (isGoogleInsufficientScopeError(error)) {
      throw new GoogleScopeMissingError();
    }
    throw error;
  }
}

export async function getSheetStatus(userId: string) {
  const connection = await googleConnectionRepository.getByUserId(userId);
  return {
    connected: !!connection?.refresh_token,
    spreadsheetId: connection?.spreadsheet_id ?? null,
    spreadsheetUrl: connection?.spreadsheet_url ?? null,
  };
}
