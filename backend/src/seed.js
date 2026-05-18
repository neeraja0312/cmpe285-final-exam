/**
 * Seed script: populates the items table with 100+ adoptable dogs.
 *
 * Strategy:
 *   1. Pull breed list from https://dog.ceo/api/breeds/list/all (free, no key).
 *   2. For each breed, fetch one random image.
 *   3. Pair with a human-friendly label and a short description.
 *   4. Insert into SQLite. Idempotent: skips if items already exist.
 *
 * Images stay hosted on Dog CEO's CDN (https://images.dog.ceo/...) — public domain.
 */

import { db } from "./db.js";

const DOG_API = "https://dog.ceo/api";
const TARGET_COUNT = 110; // a little over 100 for safety against bad URLs

function prettyLabel(breed, sub) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return sub ? `${cap(sub)} ${cap(breed)}` : cap(breed);
}

const ADJECTIVES = [
  "playful", "cuddly", "loyal", "energetic", "gentle", "curious",
  "fluffy", "spirited", "affectionate", "smart", "goofy", "brave",
  "calm", "adventurous", "sweet", "majestic", "hilarious", "soulful",
];

const HOOKS = [
  "loves long beach walks",
  "would steal your heart in 5 seconds",
  "expert napper, part-time zoomie machine",
  "looking for a forever home",
  "best couch co-pilot you'll ever meet",
  "wags first, asks questions later",
  "knows three commands, ignores all of them",
  "fully fluent in puppy-dog eyes",
  "trained for maximum cuteness",
  "carries snacks (and feelings) wisely",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeDescription(label) {
  return `${pick(ADJECTIVES).replace(/^./, c => c.toUpperCase())} ${label} — ${pick(HOOKS)}.`;
}

async function fetchBreedList() {
  const res = await fetch(`${DOG_API}/breeds/list/all`);
  if (!res.ok) throw new Error(`breeds/list failed: ${res.status}`);
  const json = await res.json();
  if (json.status !== "success") throw new Error("breeds/list returned non-success");
  return json.message; // { breed: [subBreed, ...] }
}

async function fetchImage(breed, sub) {
  const url = sub
    ? `${DOG_API}/breed/${breed}/${sub}/images/random`
    : `${DOG_API}/breed/${breed}/images/random`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json.status === "success" ? json.message : null;
}

async function main() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM items").get().n;
  if (existing >= 100) {
    console.log(`[seed] items table already has ${existing} rows; skipping. Use --force to reseed.`);
    if (!process.argv.includes("--force")) return;
    db.exec("DELETE FROM items");
    console.log("[seed] --force: cleared items table");
  }

  console.log("[seed] fetching breed list from dog.ceo …");
  const breeds = await fetchBreedList();

  // Flatten into [{breed, sub}] pairs so we can stop at TARGET_COUNT.
  const pairs = [];
  for (const [breed, subs] of Object.entries(breeds)) {
    if (subs.length === 0) {
      pairs.push({ breed, sub: null });
    } else {
      for (const sub of subs) pairs.push({ breed, sub });
    }
  }
  // Shuffle for variety
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  const insert = db.prepare(
    "INSERT INTO items (label, description, image_url) VALUES (?, ?, ?)"
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(r.label, r.description, r.image_url);
  });

  const rows = [];
  console.log(`[seed] fetching up to ${TARGET_COUNT} images (this takes ~30–60 s)…`);

  // Batch in parallel groups of 10 to be polite but reasonably fast.
  const BATCH = 10;
  for (let i = 0; i < pairs.length && rows.length < TARGET_COUNT; i += BATCH) {
    const slice = pairs.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async ({ breed, sub }) => {
        const image_url = await fetchImage(breed, sub);
        if (!image_url) return null;
        const label = prettyLabel(breed, sub);
        return { label, description: makeDescription(label), image_url };
      })
    );
    for (const r of results) {
      if (r && rows.length < TARGET_COUNT) rows.push(r);
    }
    process.stdout.write(`\r[seed] collected ${rows.length}/${TARGET_COUNT}…`);
  }
  process.stdout.write("\n");

  if (rows.length < 100) {
    throw new Error(`Only collected ${rows.length} items; need at least 100.`);
  }

  insertMany(rows);
  console.log(`[seed] inserted ${rows.length} items into the database.`);
  console.log("[seed] done.");
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
