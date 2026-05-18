import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SwipeDeck, { DeckEmpty } from "./components/SwipeDeck.jsx";
import ResultsView from "./components/ResultsView.jsx";
import {
  deleteVote,
  fetchItems,
  getOrCreateSessionId,
  postVote,
} from "./api.js";

export default function App() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("swipe"); // 'swipe' | 'results'
  const [history, setHistory] = useState([]); // [{ itemId, choice }] for undo

  // Pull-down on the deck container also opens results.
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchItems(sessionId);
        if (!cancelled) {
          setItems(list);
          setIndex(0);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const onVote = useCallback(async (item, choice) => {
    // Optimistic advance — feels instant.
    setIndex((i) => i + 1);
    setHistory((h) => [...h, { itemId: item.id, choice }]);
    try {
      await postVote({ itemId: item.id, choice, sessionId });
    } catch (e) {
      console.error("vote failed", e);
      // Roll back optimistic update on failure.
      setIndex((i) => Math.max(0, i - 1));
      setHistory((h) => h.slice(0, -1));
      setError("Couldn't save that vote — check your connection.");
      setTimeout(() => setError(null), 3000);
    }
  }, [sessionId]);

  const onUndo = useCallback(async () => {
    if (history.length === 0 || index === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    try {
      await deleteVote({ itemId: last.itemId, sessionId });
    } catch (e) {
      console.error("undo failed", e);
    }
  }, [history, index, sessionId]);

  const remaining = items.length - index;
  const progress = items.length === 0 ? 0 : Math.min(index / items.length, 1);

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence mode="wait">
        {view === "swipe" && (
          <motion.div
            key="swipe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <Header
              onOpenResults={() => setView("results")}
              progress={progress}
              voted={index}
              total={items.length}
            />

            <main
              ref={containerRef}
              className="flex-1 flex flex-col items-center justify-center px-4 pb-4"
            >
              {loading && <DeckSkeleton />}
              {!loading && error && (
                <div className="max-w-sm w-full rounded-2xl bg-red-50 border border-red-200 text-red-800 p-4 text-sm">
                  {error}
                </div>
              )}
              {!loading && !error && remaining > 0 && (
                <SwipeDeck
                  items={items}
                  index={index}
                  onVote={onVote}
                  onOpenResults={() => setView("results")}
                />
              )}
              {!loading && !error && remaining === 0 && (
                <DeckEmpty onSeeResults={() => setView("results")} />
              )}
            </main>

            {!loading && !error && remaining > 0 && (
              <ButtonRow onUndo={onUndo} canUndo={history.length > 0} />
            )}

            <Footer onOpenResults={() => setView("results")} />
          </motion.div>
        )}

        {view === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col"
          >
            <ResultsView onBack={() => setView("swipe")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ onOpenResults, progress, voted, total }) {
  return (
    <header className="px-4 pt-4 pb-2 max-w-md w-full mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐶</span>
          <h1 className="text-xl font-extrabold tracking-tight">Paw Match</h1>
        </div>
        <button
          onClick={onOpenResults}
          className="text-sm font-semibold text-slate-600 hover:text-accent transition"
        >
          Leaderboard →
        </button>
      </div>
      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <motion.div
            className="h-full bg-accent"
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
          {voted} / {total} dogs reviewed
        </p>
      </div>
    </header>
  );
}

function ButtonRow({ onUndo, canUndo }) {
  function dispatch(name) {
    window.dispatchEvent(new CustomEvent(name));
  }
  return (
    <div className="px-4 pb-3 max-w-md w-full mx-auto">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => dispatch("paw-match:vote-no")}
          className="w-16 h-16 rounded-full bg-white border-2 border-nope text-nope text-3xl font-bold shadow-card active:scale-95 transition flex items-center justify-center"
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="w-12 h-12 rounded-full bg-white border-2 border-slate-300 text-slate-500 shadow active:scale-95 transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Undo"
          title="Undo last swipe"
        >
          ↺
        </button>
        <button
          onClick={() => dispatch("paw-match:vote-yes")}
          className="w-16 h-16 rounded-full bg-white border-2 border-like text-like text-3xl font-bold shadow-card active:scale-95 transition flex items-center justify-center"
          aria-label="Adopt"
        >
          ♥
        </button>
      </div>
    </div>
  );
}

function Footer({ onOpenResults }) {
  return (
    <footer className="px-4 pb-5 pt-1 text-center">
      <button
        onClick={onOpenResults}
        className="text-xs text-slate-500 hover:text-slate-700"
      >
        ⬇ Swipe down on a card (or tap here) to see results
      </button>
    </footer>
  );
}

function DeckSkeleton() {
  return (
    <div className="w-full max-w-sm aspect-[3/4] mx-auto rounded-3xl bg-gradient-to-br from-rose-100 to-sky-100 animate-pulse shadow-card" />
  );
}
