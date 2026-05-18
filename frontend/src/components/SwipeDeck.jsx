import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "./SwipeCard.jsx";

/**
 * Renders the top 3 cards of the deck for a layered look. Only the top card
 * is interactive. When the top card commits, the parent advances `index`.
 */
export default function SwipeDeck({ items, index, onVote, onOpenResults }) {
  const visible = items.slice(index, index + 3);

  if (visible.length === 0) return null;

  return (
    <div className="relative w-full max-w-sm aspect-[3/4] mx-auto">
      <AnimatePresence initial={false}>
        {visible.map((item, i) => (
          <SwipeCard
            key={item.id}
            item={item}
            isTop={i === 0}
            stackIndex={i}
            onCommit={(action) => {
              if (action.type === "vote") onVote(item, action.choice);
              else if (action.type === "open_results") onOpenResults();
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function DeckEmpty({ onSeeResults }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm mx-auto rounded-3xl bg-white border border-black/5 shadow-card p-8 text-center"
    >
      <div className="text-5xl">🐾</div>
      <h2 className="mt-4 text-2xl font-extrabold">You've met every pup!</h2>
      <p className="mt-2 text-sm text-slate-600">
        You've voted on every dog in our shelter. See how the rest of the world voted.
      </p>
      <button
        onClick={onSeeResults}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-accent text-white font-semibold px-6 py-3 shadow-lg active:scale-95 transition"
      >
        See the leaderboard →
      </button>
    </motion.div>
  );
}
