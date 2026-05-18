import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "votes.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    image_url   TEXT    NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    session_id TEXT    NOT NULL,
    item_id    INTEGER NOT NULL,
    choice     TEXT    NOT NULL CHECK (choice IN ('yes','no')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (session_id, item_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT    PRIMARY KEY,
    started_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    ended_at   INTEGER,
    total_swipes INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_votes_item ON votes(item_id);
  CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
`);

export const DATA_PATH = DATA_DIR;
