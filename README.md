# cashlog.id

Platform pencatatan keuangan keluarga via WhatsApp — data transaksi di Google Sheet milik Anda.

## Quick start

**Preview UI tanpa config (demo mode):**
```bash
cp ct-frontend/.env.demo.example ct-frontend/.env.local
npm install && npm run dev:frontend
```

**Setup lengkap dari nol:** lihat **[LOCAL_VERIFY_GUIDE.txt](./LOCAL_VERIFY_GUIDE.txt)**

## Monorepo

```
cashlog.id/
├── ct-frontend/     # Next.js — landing, dashboard, onboarding, settings
├── ct-backend/      # Fastify — WA bot, Sheets, parser, subscription
└── LOCAL_VERIFY_GUIDE.txt
```

## Database (fresh install — satu file per DB, tanpa migration)

```bash
# Supabase (project baru): paste & run di SQL Editor
ct-frontend/supabase/schema.sql

# MySQL (drop + create ulang)
mysql -u root -p < ct-backend/database/schema.sql
```

Semua kolom sudah termasuk di schema. Tidak perlu `ALTER TABLE` terpisah.

## Run locally

```bash
npm install

cp ct-backend/.env.example ct-backend/.env      # isi credentials
cp ct-frontend/.env.example ct-frontend/.env.local

npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:3000
# atau: npm run dev:all
```

## Fitur

| Area | Detail |
|------|--------|
| Auth | Google-first (1 consent: login + Sheets), email fallback, trial Pro 7 hari |
| WA bot | Catat transaksi, perintah (`bantuan`, `hari ini`, `ringkasan`, `terakhir`), reminder 21:00 WIB |
| Pro | Scan struk multi-item, analitik, kategori custom |
| Sheet | Auto-create template, data milik user |
| Langganan | Basic Rp 29k / Pro Rp 49k — Midtrans Snap (recurring opsional) |
| Keluarga | Pro add-on Rp 5k/anggota/bulan (maks 5) — shared Sheet, pairing WA per anggota |
| Legal | `/privacy`, `/terms` |

## External services

| Service | Wajib? | Env |
|---------|--------|-----|
| Supabase | Ya | `SUPABASE_*` |
| MySQL | Ya | `MYSQL_*` |
| Google Cloud | Ya | `GOOGLE_*` |
| Midtrans | Launch berbayar | `MIDTRANS_*` |
| Resend | Opsional | `RESEND_API_KEY`, `EMAIL_FROM` |
| OpenAI/Gemini | Opsional | `OPENAI_API_KEY` / `GEMINI_API_KEY` |

Tanpa Midtrans (dev): checkout auto-aktifkan langganan. Tanpa Resend: email di-skip.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:frontend` | Next.js dev server |
| `npm run dev:backend` | Fastify + WA restore |
| `npm run dev:all` | Both |
| `npm run build` | Build all workspaces |
| `npm run seed:test-user --workspace=ct-backend` | Dev test user |

## Test user (dev)

Email: `test@cashlog.id` · Password: `test123456`

Aktifkan Email provider di Supabase, lalu jalankan seed script.
