import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "firecrawl-agent.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const fs = require("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      parts TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

// --- Conversations ---

export function createConversation(id: string, title: string, config: object) {
  const db = getDb();
  db.prepare(
    "INSERT INTO conversations (id, title, config) VALUES (?, ?, ?)",
  ).run(id, title, JSON.stringify(config));
  return { id, title };
}

export function listConversations(limit = 50) {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, title, config, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?",
    )
    .all(limit) as {
    id: string;
    title: string;
    config: string;
    created_at: number;
    updated_at: number;
  }[];
}

export function getConversation(id: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as {
    id: string;
    title: string;
    config: string;
    created_at: number;
    updated_at: number;
  } | undefined;
}

export function updateConversation(id: string, updates: { title?: string; config?: object }) {
  const db = getDb();
  if (updates.title) {
    db.prepare("UPDATE conversations SET title = ?, updated_at = unixepoch() WHERE id = ?").run(
      updates.title,
      id,
    );
  }
  if (updates.config) {
    db.prepare("UPDATE conversations SET config = ?, updated_at = unixepoch() WHERE id = ?").run(
      JSON.stringify(updates.config),
      id,
    );
  }
}

export function deleteConversation(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

// --- Messages ---

export function addMessage(
  id: string,
  conversationId: string,
  role: string,
  content: string,
  parts: unknown[] = [],
) {
  const db = getDb();
  db.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, parts) VALUES (?, ?, ?, ?, ?)",
  ).run(id, conversationId, role, content, JSON.stringify(parts));

  // Touch conversation updated_at
  db.prepare("UPDATE conversations SET updated_at = unixepoch() WHERE id = ?").run(
    conversationId,
  );
}

export function getMessages(conversationId: string) {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, role, content, parts, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    )
    .all(conversationId) as {
    id: string;
    role: string;
    content: string;
    parts: string;
    created_at: number;
  }[];
}

// --- Settings ---

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
  ).run(key, value, value);
}
