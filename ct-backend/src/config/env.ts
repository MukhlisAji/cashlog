import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  /** Trust X-Forwarded-For when behind Nginx/Caddy (needed for rate limit IP). */
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default("http://localhost:3001/api/sheets/oauth/callback"),
  OAUTH_STATE_SECRET: z.string().optional(),
  // LLM parser (OpenAI default; swap via LLM_PROVIDER=gemini)
  PARSER_MODE: z.enum(["hybrid", "rule", "llm"]).default("hybrid"),
  LLM_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  // Midtrans payment gateway (Snap + Subscription API)
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** snap = one-time Snap per bulan; recurring = Snap + auto-charge bulanan (kartu/GoPay) */
  MIDTRANS_CHECKOUT_MODE: z.enum(["snap", "recurring"]).default("snap"),
  // Subscription pricing (IDR) & trial
  PRO_PRICE: z.coerce.number().default(49_000),
  /** Pro add-on: IDR per household member slot / month */
  HOUSEHOLD_MEMBER_PRICE: z.coerce.number().default(5_000),
  MAX_HOUSEHOLD_MEMBER_SLOTS: z.coerce.number().default(5),
  TRIAL_DAYS: z.coerce.number().default(7),
  SUBSCRIPTION_PERIOD_DAYS: z.coerce.number().default(30),
  // Seed script / dev test user (optional)
  TEST_USER_EMAIL: z.string().default("test@cashlog.id"),
  TEST_USER_PASSWORD: z.string().default("test123456"),
  TEST_USER_NAME: z.string().default("Test User"),
  // Email (Resend) — https://resend.com
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  // Meta WhatsApp Cloud API (centralized B2C bot)
  META_VERIFY_TOKEN: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_API_VERSION: z.string().default("v20.0"),
  META_WEBHOOK_PATH: z.string().default("webhook"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}

export function isSupabaseConfigured(env: Env): boolean {
  return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isGoogleConfigured(env: Env): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function isMetaWhatsAppConfigured(env: Env): boolean {
  return Boolean(
    env.META_ACCESS_TOKEN &&
      env.META_PHONE_NUMBER_ID &&
      env.META_VERIFY_TOKEN,
  );
}

export function getOAuthStateSecret(env: Env): string {
  if (env.OAUTH_STATE_SECRET) {
    return env.OAUTH_STATE_SECRET;
  }

  if (env.NODE_ENV === "development") {
    return env.SUPABASE_SERVICE_ROLE_KEY ?? "cashlog-dev-secret";
  }

  throw new Error(
    "OAUTH_STATE_SECRET is required when NODE_ENV is not development",
  );
}
