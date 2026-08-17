/**
 * Buat test user di Supabase Auth untuk local development.
 *
 * Usage:
 *   cd ct-backend && npm run seed:test-user
 *
 * Credentials from ct-backend/.env:
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_NAME
 */

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../src/config/env.js";

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const testEmail = env.TEST_USER_EMAIL;
  const testPassword = env.TEST_USER_PASSWORD;
  const testName = env.TEST_USER_NAME;

  if (!url || !serviceKey) {
    console.error(
      "❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ct-backend/.env",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData } = await supabase.auth.admin.listUsers();
  const existing = listData.users.find((u) => u.email === testEmail);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: testName },
    });

    if (error) {
      console.error("❌ Gagal update user:", error.message);
      process.exit(1);
    }

    console.log("✅ Test user sudah ada — password direset");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: testName },
    });

    if (error) {
      console.error("❌ Gagal buat user:", error.message);
      process.exit(1);
    }

    console.log("✅ Test user dibuat:", data.user?.id);
  }

  console.log("");
  console.log("Login credentials:");
  console.log(`  Email:    ${testEmail}`);
  console.log(`  Password: ${testPassword}`);
  console.log("");
  console.log("Pastikan di Supabase Dashboard → Authentication → Providers:");
  console.log("  Email provider = ENABLED");
}

main();
