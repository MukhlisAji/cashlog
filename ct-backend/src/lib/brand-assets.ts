import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../..");
}

let cachedWordmark: string | null | undefined;

/** Light wordmark as a data URI for PDF HTML (white page). */
export function reportWordmarkDataUri(): string | null {
  if (cachedWordmark !== undefined) return cachedWordmark;

  const filePath = join(packageRoot(), "assets/brand/wordmark-light.png");
  if (!existsSync(filePath)) {
    cachedWordmark = null;
    return cachedWordmark;
  }

  cachedWordmark = `data:image/png;base64,${readFileSync(filePath).toString("base64")}`;
  return cachedWordmark;
}
