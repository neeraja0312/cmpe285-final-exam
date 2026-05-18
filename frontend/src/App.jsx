import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SwipeDeck, { DeckEmpty } from "./components/SwipeDeck.jsx";
import ResultsView from "./components/ResultsView.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import MatchesView from "./components/MatchesView.jsx";
import AnalyticsView from "./components/AnalyticsView.jsx";
import {
  deleteVote,
  fetchItems,
  fetchTotalItems,
  getOrCreateSessionId,
  postVote,
  postSessionStart,
  postSessionEnd,
} from "./api.js";

export default function App() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("swipe"); // 'swipe' | 'results' | 'matches' | 'admin' | 'analytics'
  const [history, setHistory] = useState([]); // [{ itemId, choice }] for undo
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);

  // Pull-down on the deck container also opens results.
  const containerRef = useRef(null);

  const refetchItems = useCallback(async () => {
    try {
      const list = await fetchItems(sessionId);
      setItems(list);
      setIndex(0);
    } catch (e) {
      console.error("Error refetching items", e);
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchItems(sessionId);
        const total = await fetchTotalItems();
        if (!cancelled) {
          setItems(list);
          setTotalItems(total);
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

  // Session lifecycle: start on mount, end on beforeunload
  useEffect(() => {
    (async () => {
      await postSessionStart(sessionId).catch(() => {});
    })();

    const handleBeforeUnload = async () => {
      await postSessionEnd(sessionId).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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
  const progress = totalItems === 0 ? 0 : Math.min(index / totalItems, 1);

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
              view={view}
              onViewChange={setView}
              progress={progress}
              voted={index}
              total={totalItems}
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

            <Footer />
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

        {view === "admin" && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col"
          >
            {adminLoggedIn ? (
              <AdminPanel
                onItemAdded={refetchItems}
                onBack={() => {
                  setAdminLoggedIn(false);
                  setView("swipe");
                }}
              />
            ) : (
              <AdminLogin
                onLogin={() => setAdminLoggedIn(true)}
                onBack={() => setView("swipe")}
              />
            )}
          </motion.div>
        )}

        {view === "matches" && (
          <motion.div
            key="matches"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col"
          >
            <MatchesView sessionId={sessionId} onBack={() => setView("swipe")} />
          </motion.div>
        )}

        {view === "analytics" && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 flex flex-col"
          >
            <AnalyticsView onBack={() => setView("swipe")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ view, onViewChange, progress, voted, total }) {
  const tabs = [
    { key: "swipe", label: "Swipe", icon: "🐶" },
    { key: "results", label: "Results", icon: "📊" },
    { key: "matches", label: "Matches", icon: "❤️" },
    { key: "analytics", label: "Analytics", icon: "📈" },
    { key: "admin", label: "Admin", icon: "➕" },
  ];

  return (
    <header className="px-4 pt-4 pb-2 max-w-md w-full mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐶</span>
          <h1 className="text-xl font-extrabold tracking-tight">Paw Match</h1>
        </div>
      </div>

      {/* Tab navigation - horizontally scrollable */}
      <div className="overflow-x-auto scrollbar-hidden mb-3 -mx-4 px-4">
        <div className="flex gap-2 w-min">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onViewChange(tab.key)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                view === tab.key
                  ? "bg-accent text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar (only on swipe view) */}
      {view === "swipe" && (
        <>
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
        </>
      )}
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

function Footer() {
  return (
    <footer className="px-4 pb-5 pt-1 text-center">
      <p className="text-xs text-slate-500">
        💡 Swipe down on a card to see results
      </p>
    </footer>
  );
}

function DeckSkeleton() {
  return (
    <div className="w-full max-w-sm aspect-[3/4] mx-auto rounded-3xl bg-gradient-to-br from-rose-100 to-sky-100 animate-pulse shadow-card" />
  );
}
