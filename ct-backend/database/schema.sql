-- =============================================================================
-- cashlog.id — MySQL schema (FRESH INSTALL ONLY)
-- =============================================================================
-- Satu file untuk setup database dari nol. Tidak ada migration terpisah.
--
--   mysql -u root -p < ct-backend/database/schema.sql
--
-- WARNING: DROP DATABASE menghapus semua data MySQL cashlog.id. Hanya untuk setup baru.
-- =============================================================================

DROP DATABASE IF EXISTS cashlog;

CREATE DATABASE cashlog
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cashlog;

-- Household (Pro add-on: shared sheet, multiple WA bots)
CREATE TABLE households (
  id                 VARCHAR(36)  NOT NULL PRIMARY KEY COMMENT 'Same as lead Supabase user id',
  lead_user_id       VARCHAR(36)  NOT NULL UNIQUE,
  member_slots_paid  TINYINT      NOT NULL DEFAULT 0 COMMENT 'Paid add-on slots (0-5)',
  max_member_slots   TINYINT      NOT NULL DEFAULT 5,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE household_members (
  id                  VARCHAR(36)  NOT NULL PRIMARY KEY,
  household_id        VARCHAR(36)  NOT NULL,
  role                ENUM('lead', 'member') NOT NULL,
  display_name        VARCHAR(64)  NOT NULL,
  phone_number        VARCHAR(20)  NULL,
  status              ENUM('invited', 'pairing', 'connected', 'revoked') NOT NULL DEFAULT 'invited',
  invite_token_hash   VARCHAR(64)  NULL,
  invite_expires_at   DATETIME     NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_household_phone (household_id, phone_number),
  INDEX idx_household_members_household (household_id),
  INDEX idx_household_members_invite (invite_token_hash),
  CONSTRAINT fk_household_members_household
    FOREIGN KEY (household_id) REFERENCES households(id)
    ON DELETE CASCADE
);

-- Session metadata per household member (Baileys)
CREATE TABLE wa_sessions (
  member_id     VARCHAR(36)  NOT NULL PRIMARY KEY,
  phone_number  VARCHAR(20)  NULL,
  status        ENUM('pending', 'connected', 'disconnected') NOT NULL DEFAULT 'disconnected',
  last_connected_at    DATETIME NULL,
  last_disconnected_at DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wa_sessions_status (status)
);

-- Baileys auth state key-value store (creds + signal keys)
CREATE TABLE wa_auth_keys (
  member_id VARCHAR(36)  NOT NULL,
  key_name  VARCHAR(255) NOT NULL,
  key_data  LONGTEXT     NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, key_name),
  CONSTRAINT fk_wa_auth_keys_session
    FOREIGN KEY (member_id) REFERENCES wa_sessions(member_id)
    ON DELETE CASCADE
);

-- User app config
CREATE TABLE user_config (
  user_id       VARCHAR(36)  NOT NULL PRIMARY KEY,
  timezone      VARCHAR(64)  NOT NULL DEFAULT 'Asia/Jakarta',
  currency      VARCHAR(8)   NOT NULL DEFAULT 'IDR',
  active_month  VARCHAR(7)   NULL COMMENT 'YYYY-MM',
  daily_tx_count INT         NOT NULL DEFAULT 0,
  daily_tx_date  DATE        NULL,
  last_evening_reminder_date DATE NULL COMMENT 'Last 21:00 WIB WA reminder',
  last_analytics_report_key VARCHAR(32) NULL COMMENT 'Dedup laporan WA: monthly:YYYY-MM / midmonth:YYYY-MM',
  last_trial_end_report_key VARCHAR(32) NULL COMMENT 'Dedup laporan trial hari ke-7',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Expense categories + parser keywords
CREATE TABLE categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(36)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  keywords    TEXT         NULL COMMENT 'comma-separated',
  color       VARCHAR(16)  NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_category (user_id, name),
  INDEX idx_categories_user (user_id)
);

-- Monthly budget per category
CREATE TABLE budgets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(36)  NOT NULL,
  month       VARCHAR(7)   NOT NULL COMMENT 'YYYY-MM',
  category    VARCHAR(64)  NOT NULL,
  amount      INT          NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_month_category (user_id, month, category),
  INDEX idx_budgets_user_month (user_id, month)
);

-- Google Sheets connection (refresh token + spreadsheet ref)
CREATE TABLE google_connections (
  user_id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  spreadsheet_id   VARCHAR(128) NULL,
  spreadsheet_url  VARCHAR(512) NULL,
  refresh_token    TEXT         NOT NULL,
  access_token     TEXT         NULL,
  token_expires_at DATETIME     NULL,
  connected_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
