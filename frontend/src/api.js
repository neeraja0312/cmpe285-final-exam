/**
 * Tiny API client. Uses the Vite dev-server proxy in development so the
 * frontend can hit /api/* without CORS headaches.
 */

const BASE = import.meta.env.VITE_API_BASE || "/api";

async function jsonOrThrow(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  return res.json();
}

export function getOrCreateSessionId() {
  const KEY = "paw-match.sessionId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
         `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export async function fetchItems(sessionId) {
  const url = sessionId
    ? `${BASE}/items?sessionId=${encodeURIComponent(sessionId)}`
    : `${BASE}/items`;
  const data = await jsonOrThrow(await fetch(url));
  return data.items;
}

export async function postVote({ itemId, choice, sessionId }) {
  return jsonOrThrow(
    await fetch(`${BASE}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, choice, sessionId }),
    })
  );
}

export async function deleteVote({ itemId, sessionId }) {
  return jsonOrThrow(
    await fetch(`${BASE}/vote`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, sessionId }),
    })
  );
}

export async function fetchResults(sort = "most_loved") {
  return jsonOrThrow(await fetch(`${BASE}/results?sort=${encodeURIComponent(sort)}`));
}

export async function fetchSessionVotes(sessionId) {
  const data = await jsonOrThrow(
    await fetch(`${BASE}/session/${encodeURIComponent(sessionId)}/votes`)
  );
  return data.votes;
}

export async function postNewItem({ label, description, imageUrl }) {
  return jsonOrThrow(
    await fetch(`${BASE}/admin/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, description, imageUrl }),
    })
  );
}

export async function fetchMatches(sessionId, threshold = 50) {
  const url = `${BASE}/matches/${encodeURIComponent(sessionId)}?threshold=${threshold}`;
  const data = await jsonOrThrow(await fetch(url));
  return data;
}

export async function postSessionStart(sessionId) {
  return jsonOrThrow(
    await fetch(`${BASE}/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
  );
}

export async function postSessionEnd(sessionId) {
  return jsonOrThrow(
    await fetch(`${BASE}/session/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
  ).catch(() => ({ ok: false })); // Fail silently if beforeunload timing is tight
}

export async function fetchAnalytics() {
  const data = await jsonOrThrow(await fetch(`${BASE}/analytics`));
  return data;
}
