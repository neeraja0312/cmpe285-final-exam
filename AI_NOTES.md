# AI Usage Notes

_CMPE 285 Final — Question 10. Required AI write-up._

I built **Paw Match** as an AI-assisted exercise, with **Claude (Opus 4.x in
Cursor)** as the primary pair-programmer.

## What Claude wrote end-to-end

- The first pass of the **SQLite schema** (`items` + `votes` with the
  composite primary key for dedup) and the corresponding `INSERT … ON
  CONFLICT … DO UPDATE` upsert in `POST /api/vote`.
- The **seed script** that walks `dog.ceo`'s breed list, batches image
  fetches in groups of 10, and inserts 110 rows in one transaction.
- The first draft of the Framer Motion **swipe card**: drag → tilt via
  `useTransform`, ADOPT/NOPE stamps that fade in past a threshold, flick-off
  animation on commit.
- The **results aggregation SQL** with `most_loved` / `most_divisive` /
  `most_skipped` sort modes (divisiveness as `1 − |yes−no|/total`).
- The Tailwind config and mobile layout scaffolding (header + progress bar
  + button row).

## Where I had to push back / rewrite

**Concrete example — pull-to-open-results vs. ghost votes.**

Claude's first draft of `SwipeCard.jsx` treated _any_ drag-release outside
the snap-back zone as a commit, including a downward drag. That meant pulling
the card down to open the results view also fired a `yes`/`no` vote (whichever
direction the drag had drifted toward). I caught this by reading the
`onDragEnd` handler line-by-line before running the app. I rewrote the handler
to **branch on whichever axis dominated** — if `|dy| > |dx|` _and_ `dy > 120`,
treat it as "open results" and reset position with a spring, **without**
calling `onVote`. The current code in `SwipeCard.jsx` reflects that fix.

A few smaller rewrites:

- Claude initially used `localStorage` for vote persistence in the first
  scaffolding suggestion. I pushed back because the brief explicitly says
  localStorage is _not_ sufficient as a source of truth — that drove the
  switch to SQLite as the authoritative store with localStorage limited to
  caching just the anonymous session ID.
- The first results query did `COUNT(*)` per row, which inflated counts when
  the LEFT JOIN had multiple matches. I tightened it to
  `SUM(CASE WHEN choice='yes' …)` and `COUNT(v.item_id)` (which is null-safe
  on the LEFT JOIN) before I trusted the numbers.

## One thing Claude did better than expected

Picking the **deck visualization** trick — stacking three cards with
decreasing `scale` and a small `y` offset and only the top one interactive —
gave the UI a polished "real deck" feel for free. I would've shipped a single
card and called it done.

## One thing Claude did worse than expected

**Gesture direction collision** (the pull-down example above) is exactly the
kind of subtle interaction bug an AI is bad at catching, because both
behaviors "look right" in isolation. I had to actually trace what happens when
the user drags diagonally to find it. Treat any non-trivial gesture logic as
requiring a human read-through, not a vibe check.

## Other AI tools

I used **Cursor's tab-complete** for boilerplate (Tailwind class names,
JSDoc, repetitive props). Claude was the architect; Cursor's inline model
was the typist. I did not use any other coding assistants.
