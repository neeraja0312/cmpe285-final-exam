import express from "express";
import cors from "cors";
import { db } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "32kb" }));

const PORT = process.env.PORT || 4000;

// ---------------- helpers ----------------

function isNonEmptyString(v, max = 200) {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

// ---------------- routes ----------------

app.get("/api/health", (_req, res) => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM items").get();
  res.json({ ok: true, items: n });
});

/**
 * GET /api/items
 * Returns all voteable items. Optional ?sessionId=... excludes items the user
 * has already voted on, so the client can serve a fresh deck on reload.
 */
app.get("/api/items", (req, res) => {
  const { sessionId } = req.query;
  let rows;
  if (typeof sessionId === "string" && sessionId.length > 0) {
    rows = db
      .prepare(
        `SELECT i.id, i.label, i.description, i.image_url AS imageUrl
         FROM items i
         WHERE i.id NOT IN (SELECT item_id FROM votes WHERE session_id = ?)
         ORDER BY RANDOM()`
      )
      .all(sessionId);
  } else {
    rows = db
      .prepare(
        `SELECT id, label, description, image_url AS imageUrl
         FROM items
         ORDER BY RANDOM()`
      )
      .all();
  }
  res.json({ items: rows });
});

/**
 * POST /api/vote
 * Body: { itemId: number, choice: 'yes'|'no', sessionId: string }
 * Idempotent on (sessionId, itemId): re-voting updates the existing row.
 */
app.post("/api/vote", (req, res) => {
  const { itemId, choice, sessionId } = req.body || {};

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: "itemId must be a positive integer" });
  }
  if (choice !== "yes" && choice !== "no") {
    return res.status(400).json({ error: "choice must be 'yes' or 'no'" });
  }
  if (!isNonEmptyString(sessionId, 128)) {
    return res.status(400).json({ error: "sessionId must be a non-empty string (<=128 chars)" });
  }

  const item = db.prepare("SELECT id FROM items WHERE id = ?").get(itemId);
  if (!item) return res.status(404).json({ error: "unknown itemId" });

  // UPSERT — dedups by (session_id, item_id).
  db.prepare(
    `INSERT INTO votes (session_id, item_id, choice)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id, item_id) DO UPDATE
        SET choice = excluded.choice,
            updated_at = strftime('%s','now')`
  ).run(sessionId, itemId, choice);

  res.json({ ok: true });
});

/**
 * DELETE /api/vote
 * Body: { itemId: number, sessionId: string }
 * Used by the Undo button — removes the most recent vote for this item.
 */
app.delete("/api/vote", (req, res) => {
  const { itemId, sessionId } = req.body || {};
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ error: "itemId must be a positive integer" });
  }
  if (!isNonEmptyString(sessionId, 128)) {
    return res.status(400).json({ error: "sessionId required" });
  }
  const info = db
    .prepare("DELETE FROM votes WHERE session_id = ? AND item_id = ?")
    .run(sessionId, itemId);
  res.json({ ok: true, removed: info.changes });
});

/**
 * POST /api/admin/items
 * Body: { label: string, description: string (optional), imageUrl: string }
 * Adds a new item to the items table for voting.
 */
app.post("/api/admin/items", (req, res) => {
  const { label, description, imageUrl } = req.body || {};

  if (!isNonEmptyString(label, 200)) {
    return res.status(400).json({ error: "label must be a non-empty string (<=200 chars)" });
  }
  if (description !== undefined && !isNonEmptyString(description, 500)) {
    return res.status(400).json({ error: "description must be a string (<=500 chars)" });
  }
  if (!isNonEmptyString(imageUrl, 500)) {
    return res.status(400).json({ error: "imageUrl must be a non-empty string (<=500 chars)" });
  }

  // Validate imageUrl looks like a URL
  try {
    new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: "imageUrl must be a valid URL" });
  }

  const info = db
    .prepare(
      `INSERT INTO items (label, description, image_url)
       VALUES (?, ?, ?)`
    )
    .run(label, description || "", imageUrl);

  const createdAt = db
    .prepare("SELECT created_at FROM items WHERE id = ?")
    .get(info.lastInsertRowid);

  res.json({
    ok: true,
    itemId: info.lastInsertRowid,
    createdAt: createdAt?.created_at,
  });
});

/**
 * GET /api/results?sort=most_loved|most_divisive|most_skipped|most_voted
 * Aggregates across ALL users (the source of truth).
 */
app.get("/api/results", (req, res) => {
  const sort = String(req.query.sort || "most_loved");
  const totalSessions = db
    .prepare("SELECT COUNT(DISTINCT session_id) AS n FROM votes")
    .get().n;

  const rows = db
    .prepare(
      `SELECT
         i.id,
         i.label,
         i.description,
         i.image_url AS imageUrl,
         COALESCE(SUM(CASE WHEN v.choice = 'yes' THEN 1 ELSE 0 END), 0) AS yes,
         COALESCE(SUM(CASE WHEN v.choice = 'no'  THEN 1 ELSE 0 END), 0) AS no,
         COUNT(v.item_id) AS total
       FROM items i
       LEFT JOIN votes v ON v.item_id = i.id
       GROUP BY i.id`
    )
    .all();

  for (const r of rows) {
    r.yesRate = r.total > 0 ? r.yes / r.total : 0;
    // "Divisiveness" peaks at a 50/50 split; 0 when one-sided or no votes.
    r.divisiveness = r.total > 0 ? 1 - Math.abs(r.yes - r.no) / r.total : 0;
    // "Skip" proxy: fraction of total sessions that did NOT vote on this item.
    r.skipRate = totalSessions > 0 ? 1 - r.total / totalSessions : 0;
  }

  const sorters = {
    most_loved: (a, b) =>
      b.yesRate - a.yesRate || b.yes - a.yes || a.label.localeCompare(b.label),
    most_divisive: (a, b) =>
      b.divisiveness - a.divisiveness || b.total - a.total,
    most_skipped: (a, b) =>
      b.skipRate - a.skipRate || a.total - b.total,
    most_voted: (a, b) => b.total - a.total,
  };
  const cmp = sorters[sort] || sorters.most_loved;
  rows.sort(cmp);

  res.json({ sort, totalSessions, results: rows });
});

/**
 * GET /api/session/:sessionId/votes
 * Returns the current user's votes (used to restore "yes" matches view, etc.).
 */
app.get("/api/session/:sessionId/votes", (req, res) => {
  const { sessionId } = req.params;
  if (!isNonEmptyString(sessionId, 128)) {
    return res.status(400).json({ error: "invalid sessionId" });
  }
  const rows = db
    .prepare(
      `SELECT v.item_id AS itemId, v.choice, v.updated_at AS updatedAt,
              i.label, i.image_url AS imageUrl
       FROM votes v JOIN items i ON i.id = v.item_id
       WHERE v.session_id = ?
       ORDER BY v.updated_at DESC`
    )
    .all(sessionId);
  res.json({ votes: rows });
});

/**
 * GET /api/matches/:sessionId?threshold=50
 * Returns items where the user voted "yes" AND global yes-rate >= threshold (0-100).
 * Threshold default is 50 (50%).
 */
app.get("/api/matches/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const threshold = Math.max(0, Math.min(100, parseInt(req.query.threshold || "50", 10))) / 100;

  if (!isNonEmptyString(sessionId, 128)) {
    return res.status(400).json({ error: "invalid sessionId" });
  }

  // Get total sessions for skip-rate calculation
  const totalSessions = db
    .prepare("SELECT COUNT(DISTINCT session_id) AS n FROM votes")
    .get().n;

  // Find items where this user voted "yes" and compute global stats
  const rows = db
    .prepare(
      `SELECT 
         i.id,
         i.label,
         i.description,
         i.image_url AS imageUrl,
         COALESCE(SUM(CASE WHEN v.choice = 'yes' THEN 1 ELSE 0 END), 0) AS yes,
         COALESCE(SUM(CASE WHEN v.choice = 'no'  THEN 1 ELSE 0 END), 0) AS no,
         COUNT(v.item_id) AS total
       FROM items i
       LEFT JOIN votes v ON v.item_id = i.id
       WHERE i.id IN (
         SELECT item_id FROM votes WHERE session_id = ? AND choice = 'yes'
       )
       GROUP BY i.id`
    )
    .all(sessionId);

  // Calculate derived metrics and filter by threshold
  const matches = [];
  for (const r of rows) {
    r.yesRate = r.total > 0 ? r.yes / r.total : 0;
    r.skipRate = totalSessions > 0 ? 1 - r.total / totalSessions : 0;
    if (r.yesRate >= threshold) {
      matches.push(r);
    }
  }

  // Sort by yes-rate descending
  matches.sort((a, b) => b.yesRate - a.yesRate || b.yes - a.yes);

  res.json({ sessionId, threshold: Math.round(threshold * 100), matches });
});

// ---------------- boot ----------------

app.listen(PORT, () => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM items").get();
  console.log(`[paw-match] listening on http://localhost:${PORT}  (items in DB: ${n})`);
  if (n === 0) {
    console.log("[paw-match]  Run `npm run seed` to populate the database.");
  }
});
