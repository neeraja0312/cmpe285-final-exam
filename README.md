# Paw Match 🐾 — Adopt-a-Dog Swipe

A mobile-first, swipe-to-vote web app for the **CMPE 285 Spring 2026 Final, Question 10**.

> **Theme.** Browse 100+ adoptable dogs from real shelter-style breed photos.
> Swipe **right** to virtually adopt, **left** to pass, **down** (or tap a
> button) to see how the rest of the world voted. Built as an AI-assisted
> exercise with Claude as the primary collaborator.

---

## 🎬 Demo

- **Live walkthrough (YouTube):** _(link goes here after recording)_
- Three screenshots are pasted into the Pages exam doc under Q10.

---

## 🧱 Architecture (1-paragraph version)

The app is split into a tiny Node/Express backend and a Vite + React + Framer
Motion frontend. The backend persists every vote in a local **SQLite**
database (`better-sqlite3`) with a composite primary key on
`(session_id, item_id)` so that a user re-voting on the same dog UPSERTs the
existing row instead of double-counting — that is the source of truth for the
results view. Anonymous **session IDs** are minted in the browser
(`crypto.randomUUID`) and stored in `localStorage` only as a cache for the
user's own identity; aggregate counts always come from the server. The frontend
is a single React app with two views — a Tinder-style swipe deck powered by
Framer Motion drag gestures, and a results leaderboard that polls
`GET /api/results` every 5 seconds for near-real-time updates.

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│  React + Vite + Tailwind   │  /api   │  Node + Express              │
│  Framer Motion swipe deck  │ ──────▶ │  better-sqlite3 (votes.db)   │
│  sessionId in localStorage │         │  /items /vote /results …     │
└────────────────────────────┘         └──────────────────────────────┘
```

---

## ⚖️ Architecture trade-offs

Every choice below was made deliberately under a ~2-hour time box. The
governing principle was **"minimize moving parts that can fail on demo
day"** — i.e. prefer one process over two, one file over a service, sync
over async, and well-trodden libraries over clever ones.

### Stack

| Decision | What I picked | What I rejected | Why |
| --- | --- | --- | --- |
| **Backend language** | Node 18+ / Express | Python (Flask/FastAPI), Go | Same language as the frontend → one mental model, one `npm`, no context switch. Express's API surface (~5 LOC to serve JSON) is the fastest path for a 6-endpoint API. |
| **Frontend framework** | React 18 + Vite | Vue, Svelte, vanilla | Largest ecosystem of swipe-card libraries to fall back on; Vite gives sub-second HMR and zero-config TS-ready dev server; React's hooks made the optimistic-UI logic in `App.jsx` four lines. |
| **Styling** | Tailwind | CSS modules, styled-components | Mobile-first utilities (`max-w-sm`, `aspect-[3/4]`, `safe-area`-friendly padding) make a polished iPhone layout fast. No naming bikeshed. Trade-off: HTML is busier — acceptable for an exam-scope codebase. |
| **Gestures** | Framer Motion | `react-tinder-card`, raw pointer events, `@use-gesture` | Framer's `useMotionValue` + `useTransform` lets card rotation, color tint, and stamp opacity all derive from one shared `x` motion value — that is the only reason the swipe *feels* right. A pre-built card lib would've been faster but harder to customize for the pull-down-to-results gesture. |
| **Bundler / dev server** | Vite | webpack, Next.js, CRA | No need for SSR/routing/SEO. Vite's `proxy` config makes the `/api` boundary disappear in development — zero CORS plumbing. |
| **Repo layout** | Split `backend/` + `frontend/` with their own `package.json` | npm workspaces / monorepo tooling | Each side is independently installable / runnable; graders running a fresh clone don't need to learn workspace flags. Cost: two `npm install`s. |

### Data & networking

| Decision | What I picked | What I rejected | Why |
| --- | --- | --- | --- |
| **Persistence** | SQLite (`better-sqlite3`) | Postgres, MongoDB, JSON-file-with-locking, Firebase | See full comparison in the *Persistence layer* section below. TL;DR: one file, zero services, sync API, ACID. |
| **Live aggregates** | **Polling** `GET /api/results` every 5 s | WebSockets, Server-Sent Events | Polling is 12 lines of `setInterval`; SSE is ~40 LOC of extra server plumbing for marginal UX gain on a single-server demo. Bandwidth is negligible — the results payload is < 8 KB. |
| **Optimistic UI on vote** | Advance the deck *before* the POST resolves; roll back on error | "Block on network round-trip" | A 200 ms network blip should not make the card stutter. The rollback path (`setIndex(i-1)`) is six lines. |
| **Identity** | Anonymous `sessionId` minted with `crypto.randomUUID()`, persisted in `localStorage` | Real auth (OAuth, magic-link), no identity at all | The brief allows "anonymous session ID at minimum." Real auth is 4× the LOC and adds a third moving part (auth provider). Anonymous is enough to make dedup, undo, and "your own votes" features work. |
| **Image hosting** | Hot-link images from `images.dog.ceo` (CDN) | Mirror images locally into `backend/public` | Mirroring saves ~100 HTTP requests but adds a fetch step in the seed script and a public-files server route. Trade-off: if dog.ceo's CDN flaps, we see broken cards (documented under *Known issues*). |
| **Result sorting** | Compute in Node after a single SQL aggregation | Push the sort into SQL with parameterized `ORDER BY` | The full result set is ≤ 110 rows — sorting in JS is free and lets me compute derived fields (`divisiveness`, `skipRate`) in one pass. |

### What I'd add given more time

- **Switch results updates to SSE** — one-line change on the client (`new EventSource`), ~15 LOC on the server, and the polling overhead disappears.
- **Add a `nonce`/idempotency key to `POST /api/vote`** so a retry on a flaky network is provably safe even if `(sessionId, itemId)` could collide for legitimate reasons (it can't here, but it's good hygiene).
- **Replace the in-memory `dog.ceo` seed with a pre-mirrored fixture file** committed to the repo. Currently the seed needs internet on first run.
- **A `dotenv` config layer** so `PORT`, `DB_PATH`, and `POLL_INTERVAL` aren't hard-coded.

---

## ▶️ How to run

Requires **Node 18+** (tested on Node 24).

### 1. Backend

```bash
cd backend
npm install
npm run seed     # fetches 110 dog photos from dog.ceo and inserts them
npm start        # listens on http://localhost:4000
```

The seed command is idempotent — it will skip if items already exist.
Use `npm run seed -- --force` to wipe and reseed.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev      # opens http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so the
frontend and backend can run side-by-side with zero CORS config.

> **Mobile test.** Hit `http://<your-LAN-ip>:5173` from your phone, or use
> Chrome DevTools → device toolbar → iPhone 14 (390 × 844).

---

## 🌐 API surface

| Method | Path                                  | Purpose                                                |
| ------ | ------------------------------------- | ------------------------------------------------------ |
| GET    | `/api/health`                         | Liveness + count of seeded items                       |
| GET    | `/api/items?sessionId=…`              | Voteable items; excludes ones this session already voted on |
| POST   | `/api/vote`                           | Record a vote `{ itemId, choice, sessionId }` — UPSERT |
| DELETE | `/api/vote`                           | Undo a session's vote on an item                       |
| GET    | `/api/results?sort=…`                 | Aggregate yes/no per item; `most_loved` (default), `most_divisive`, `most_skipped`, `most_voted` |
| GET    | `/api/session/:sessionId/votes`       | Current user's own vote history                        |
| POST   | `/api/admin/items`                    | **[Stretch]** Add new item to the deck; `{ label, description, imageUrl }` |
| GET    | `/api/matches/:sessionId?threshold=50` | **[Stretch]** User's "yes" votes filtered by global yes-rate threshold (0-100) |
| POST   | `/api/session/start`                  | **[Stretch]** Record session start for analytics tracking |
| POST   | `/api/session/end`                    | **[Stretch]** Record session end and total swipes       |
| GET    | `/api/analytics`                      | **[Stretch]** Aggregate stats: total sessions, total swipes, avg swipes/session, unique days |

### Idempotency / dedup — full approach

**The brief:** *"A single user voting twice on the same item should not
double-count."*

**The rule, in one line:** `(session_id, item_id)` is unique — every (user,
item) pair owns exactly one row, ever.

#### Schema

```sql
CREATE TABLE votes (
  session_id TEXT    NOT NULL,
  item_id    INTEGER NOT NULL,
  choice     TEXT    NOT NULL CHECK (choice IN ('yes','no')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (session_id, item_id),                -- enforces uniqueness
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

The composite **PRIMARY KEY** (not just a `UNIQUE INDEX`) is the load-bearing
constraint: SQLite will refuse to insert a second row for the same pair, full
stop. Even if the application layer had a bug, the database would.

#### Write path — UPSERT

`POST /api/vote` uses **SQLite's `INSERT … ON CONFLICT … DO UPDATE`** so the
write is **idempotent at the SQL layer**, not just in application code:

```sql
INSERT INTO votes (session_id, item_id, choice)
VALUES (?, ?, ?)
ON CONFLICT(session_id, item_id) DO UPDATE
   SET choice = excluded.choice,
       updated_at = strftime('%s','now');
```

This is a single atomic statement — no `SELECT`-then-`INSERT` race window.

#### Behavior matrix

| Scenario | What happens | Final # of rows for (sid, iid) | Aggregate impact |
| --- | --- | --- | --- |
| First vote on an item | `INSERT` succeeds | 1 | +1 to that choice |
| Same user re-votes **same choice** (refresh, double-tap, retry) | `ON CONFLICT` fires, only `updated_at` changes | 1 | No change |
| Same user re-votes **different choice** (changed their mind) | `ON CONFLICT` fires, `choice` is overwritten | 1 | -1 from old choice, +1 to new |
| Same user votes from a second tab | Same `sessionId` (it's keyed off `localStorage`), so → UPSERT | 1 | Behaves like above |
| Same user clears `localStorage` and votes again | New `sessionId` → treated as a **new user**, counts once | 2 (different `sid`s) | +1 (intentional: we have no way to tie the two anonymous identities) |
| Network glitch → client retry of the same POST | UPSERT idempotent → safe | 1 | No double count |
| User taps Undo | `DELETE /api/vote` removes the row | 0 | -1 from whatever choice it was |

#### Read-side guarantees

Because aggregates are computed with
`SUM(CASE WHEN choice='yes' THEN 1 ELSE 0 END)` over the `votes` table — and
the table can't *contain* a duplicate (sid, iid) — the aggregate is provably
free of double-counts. There is no application-level "have we seen this
before?" check; the database is the source of truth.

#### Why not the alternatives I considered

- **Append-only votes table + "last write wins" `SELECT MAX(updated_at)`:**
  simpler write, but every aggregate query needs a window function. Trades
  write simplicity for read complexity. Bad bet when reads run on a 5 s
  poll.
- **Application-level dedup (check-then-insert):** classic TOCTOU race. Two
  near-simultaneous POSTs from the same user could both pass the check and
  both insert. The composite PK closes that hole at the DB layer.
- **Client-side dedup only (disable button after first vote):** loses the
  guarantee across reloads and across devices. Brief explicitly says
  `localStorage` is not the source of truth.
- **Idempotency-key header (Stripe-style `Idempotency-Key`):** strictly
  better for retry safety, but overkill at this scope — `(sessionId, itemId)`
  *is* the natural idempotency key for this domain.

---

### Persistence layer — justification

**Choice: SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3).**

The brief explicitly allowed *"SQLite, Postgres, MongoDB, a JSON file with
proper locking, or a managed service."* Here's the head-to-head I ran:

| Option | Pros | Cons | Verdict for this exam |
| --- | --- | --- | --- |
| **SQLite** (chosen) | One file, zero services. Full SQL incl. `ON CONFLICT … DO UPDATE`. ACID transactions. WAL mode → concurrent reads with the polling client. `better-sqlite3` is **synchronous** → no `async`/`await` noise in the API handlers. Cloneable + reproducible. | Single-writer at a time (fine here — single Node process). Not suitable for horizontal scale-out. | ✅ **Chosen.** Hits every requirement with the smallest moving-part count. |
| **Postgres** | Production-grade, scales horizontally, rich types (`jsonb`, arrays). | Requires running `docker` / `brew services` / a managed instance just to demo. Connection-pool config to think about. Async driver leaks `await` into every handler. | ❌ Overkill for ≤ 110 items × a handful of sessions, and the grader has to install/run it. |
| **MongoDB** | Schemaless writes are fast to iterate on. Native dedup via `updateOne({...}, {upsert:true})`. | Same operational cost as Postgres (separate `mongod`). Aggregation pipeline syntax is heavier than the SQL I'd write. Composite-key uniqueness needs an explicit index. | ❌ All of Postgres's downsides without the SQL ergonomics. |
| **JSON file with locking** | Truly minimal — no library at all. | Locking has to be done by hand (`proper-lockfile` or `flock`). Every write is an O(N) rewrite of the full file. No atomic UPSERT — read, mutate, write, hope. Easy to corrupt under crash. | ❌ The "minimal" of this option is illusory once you handle concurrency correctly. |
| **Managed (Firebase / Supabase)** | Real-time subscriptions for free, hosted, auth bundled. | Requires an internet-connected account, API keys, vendor SDK. Demo dies if WiFi flakes. Locks the project to a vendor. | ❌ Adds a third-party dependency for an offline-able exam app. |

#### Why SQLite wins here specifically

1. **Zero-install for the grader.** `npm install` builds the native binding;
   `npm start` works. No background daemon, no `docker compose`.
2. **The `better-sqlite3` API is synchronous.** That single fact lets the
   Express handlers stay flat — `db.prepare(...).run(...)` instead of
   `await db.query(...)`. Less surface area for bugs under time pressure.
3. **Native UPSERT semantics** map 1:1 onto the dedup rule. There's no
   impedance mismatch between "exactly one row per (user, item)" and what
   the database enforces.
4. **WAL mode** (`PRAGMA journal_mode = WAL`) means the 5-second results
   poll never blocks on a write, even though SQLite is single-writer.
5. **The `votes.db` file is the entire production state.** It can be
   inspected with `sqlite3` CLI, copied for backup, and is small enough
   to attach to a bug report.

#### When this choice would be wrong

- Multi-process backend (PM2 cluster, multiple AWS Lambdas) — SQLite's
  single-writer model would serialize them. Move to Postgres.
- Need real-time push without polling — Postgres `LISTEN/NOTIFY` or a
  managed service (Supabase/Firebase) becomes attractive.
- Items count and vote volume in the **millions** — SQLite still works,
  but you'd want a real ops story (backups, replicas).

For an exam-scope demo with one Node process and ≤ 110 items, none of those
apply.

---

## 🚀 Stretch features

Beyond the core 6 requirements, three additional features were implemented to maximize exam score:

### 1. Admin Panel — Add items on the fly

**The problem:** All items are seeded at startup. Adding new dogs requires rerunning the seed script.

**The solution:** `POST /api/admin/items` endpoint + React form component.

- Form accepts: **label** (required), **description** (optional), **image URL** (required, with validation).
- **Live image preview** as you type the URL.
- Success message fades in/out; errors displayed inline.
- Backend validates: label length (1–200 chars), description (≤ 500), URL format and length.
- New item immediately appears in the swipe deck on next cycle.
- Located in the "Admin ➕" tab.

**Files:**
- Backend: `POST /api/admin/items` in `server.js`
- Frontend: `AdminPanel.jsx` component

---

### 2. Matches View — Discover community favorites

**The problem:** You voted "yes" on 50 dogs, but which ones did *others* also love?

**The solution:** `GET /api/matches/:sessionId?threshold=50` + interactive slider.

- Displays **your "yes" votes** filtered by global **yes-rate threshold** (0–100%).
- **Threshold slider** lets you adjust in real-time (step 5%); UX: drag to filter.
- Returns items sorted by yes-rate descending, with counts: `{ label, imageUrl, yes, no, yesRate }`.
- Example: at 50% threshold, a dog with 6 yes / 4 no (60% yes-rate) appears; at 100% threshold, it's hidden.
- Located in the "Matches ❤️" tab.

**Algorithm:**
```sql
SELECT i.id, i.label, i.image_url,
       COUNT(CASE WHEN v.choice='yes' THEN 1 END) AS yes,
       COUNT(CASE WHEN v.choice='no' THEN 1 END) AS no
FROM items i
JOIN votes v ON i.id = v.item_id
WHERE v.session_id = ? AND v.choice='yes'
GROUP BY i.id
HAVING (COUNT(CASE WHEN v.choice='yes' THEN 1 END) * 100.0 /
        (COUNT(*))) >= ?
```

**Files:**
- Backend: `GET /api/matches/:sessionId` in `server.js`
- Frontend: `MatchesView.jsx` component with slider and match cards

---

### 3. Analytics Dashboard — Session tracking

**The problem:** How many people are using Paw Match? How long are they spending?

**The solution:** Session lifecycle tracking + aggregate analytics endpoint.

**Features:**
- **Session start/end**: Called automatically on App mount and `beforeunload`.
- **Swipe counter**: Increments in the `sessions` table whenever a new vote is cast (UPSERT-safe).
- **Aggregate statistics**: 
  - Total sessions
  - Total swipes across all sessions
  - Average swipes per session
  - Number of unique days with activity
- **Live polling**: Refreshes every 5 seconds; displays 4 stat cards with emoji icons.
- Located in the "Analytics 📈" tab.

**Database schema:**
```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  started_at INTEGER DEFAULT (strftime('%s','now')),
  ended_at   INTEGER,
  total_swipes INTEGER DEFAULT 0
);
```

**Endpoints:**
- `POST /api/session/start { sessionId }` — Insert or ignore if already exists.
- `POST /api/session/end { sessionId }` — Mark session as ended; return total swipes and duration.
- `GET /api/analytics` — Returns `{ totalSessions, totalSwipes, avgSwipesPerSession, uniqueDays }`.

**Files:**
- Backend: 3 new endpoints, session lifecycle tracking in `server.js`; new `sessions` table in `db.js`
- Frontend: `AnalyticsView.jsx` component; session lifecycle hooks in `App.jsx`

---

## 🎨 UI / Tab Navigation

All views are accessible via 5 tabs in the header:

- **🐶 Swipe** — Main voting interface (swipe card deck)
- **📊 Results** — Real-time aggregate leaderboard (polls every 5 s)
- **❤️ Matches** — Your "yes" votes filtered by threshold (tab 2)
- **📈 Analytics** — Session & engagement stats (tab 3)
- **➕ Admin** — Add new items to the deck (tab 4)

---

## 💾 Updated database schema

The `votes.db` SQLite file now contains three tables:

```sql
-- Original tables
items (id PK, label, description, image_url, created_at)
votes (session_id, item_id, choice, created_at, updated_at; PK=(session_id, item_id))

-- New table (for analytics & matches)
sessions (session_id PK, started_at, ended_at, total_swipes)
```

---



### Core (Section 3.1)

- [x] **Theme** — Adoptable dogs (documented above).
- [x] **≥ 100 distinct items** — 110 dogs seeded from dog.ceo with label, description, and image URL.
- [x] **Swipe card UI** — right = adopt, left = pass; live tilt; green / red color tint as you drag; ADOPT / NOPE stamps fade in past the threshold; smooth flick-off animation; next card auto-promoted.
- [x] **Tap "Yes" / "No" buttons** — also wired to the gesture, for desktop graders and accessibility.
- [x] **Results view** — reachable by swiping the card down or tapping the leaderboard button; shows aggregate yes/no for every item; **four sort modes** (most loved, most divisive, most skipped, most voted).
- [x] **Backend persistence** — SQLite is the source of truth; localStorage only caches the anonymous session ID.
- [x] **End-of-deck state** — friendly "You've met every pup!" screen with a CTA to the leaderboard.

### Stretch (Section 3.2)

- [x] **Anonymous session ID** persisted in localStorage — your votes carry across reloads (the server filters them out of `/items`).
- [x] **Undo last swipe** — restores the previous card and `DELETE`s the vote from the backend.
- [x] **Real-time-ish aggregates** — results view polls `/api/results` every 5 s.
- [x] **Admin panel** — add new items to the deck without code/reseeding; form with validation and live image preview.
- [x] **Matches view** — display your "yes" votes filtered by global yes-rate threshold (0–100%); discover community favorites.
- [x] **Analytics dashboard** — track session counts, total swipes, average swipes per session, and unique days; live polling every 5 s.

### Out of scope (per the brief)

Native iOS/Android builds, production deployment, payments, moderation tooling.

---

## 📁 Layout

```
cmpe285-finalexam-app/
├── README.md
├── AI_NOTES.md
├── backend/
│   ├── package.json
│   ├── data/             # votes.db is created here (gitignored)
│   └── src/
│       ├── db.js         # SQLite + schema
│       ├── seed.js       # fetches 110 dogs from dog.ceo
│       └── server.js     # Express endpoints
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── styles.css
        └── components/
            ├── SwipeCard.jsx
            ├── SwipeDeck.jsx
            └── ResultsView.jsx
```

---

## 📷 Image attribution

All dog images are served from the **[Dog CEO Dog API](https://dog.ceo/dog-api/)**
(public, free, no key). Photos are sourced from the Stanford Dogs dataset under
permissive academic use. Credit: the Dog CEO maintainers and Stanford CS / ImageNet.

---

## 🐛 Known issues / gaps

- Dog CEO image CDN occasionally serves a 404 for a given URL. If you see a
  broken card, swipe past it; the next seed run will refresh URLs.
- Polling every 5 s for results is slightly wasteful; a tiny SSE channel would
  be the next obvious upgrade.
- No service worker / offline mode — out of scope for the exam.
