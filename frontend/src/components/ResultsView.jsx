import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchResults } from "../api.js";

const SORTS = [
  { key: "most_loved",    label: "Most loved" },
  { key: "most_divisive", label: "Most divisive" },
  { key: "most_skipped",  label: "Most skipped" },
  { key: "most_voted",    label: "Most voted" },
];

export default function ResultsView({ onBack }) {
  const [sort, setSort] = useState("most_loved");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load(sortKey) {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchResults(sortKey);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(sort); }, [sort]);

  // Poll every 5 s for real-time-ish aggregate updates (Stretch goal #10).
  useEffect(() => {
    const id = setInterval(() => load(sort), 5000);
    return () => clearInterval(id);
  }, [sort]);

  return (
    <div className="flex flex-col h-full max-w-md mx-auto w-full">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-black/5 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition w-9 h-9 flex items-center justify-center text-slate-700"
          aria-label="Back to swiping"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold leading-none">Leaderboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data ? `${data.totalSessions} session${data.totalSessions === 1 ? "" : "s"} have voted` : "Live aggregate"}
          </p>
        </div>
      </header>

      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto scroll-thin">
        {SORTS.map(s => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={
              "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition " +
              (sort === s.key
                ? "bg-accent text-white shadow"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto scroll-thin px-4 pb-8">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 p-3 text-sm">
            Couldn't load results: {error}
          </div>
        )}
        {loading && !data && (
          <div className="space-y-3 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-2xl border border-black/5 animate-pulse" />
            ))}
          </div>
        )}
        {data && (
          <ul className="space-y-2 mt-2">
            {data.results.map((r, idx) => (
              <ResultRow key={r.id} rank={idx + 1} row={r} sort={sort} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ResultRow({ rank, row, sort }) {
  const yesPct = row.total > 0 ? Math.round(row.yesRate * 100) : 0;
  const divisivePct = Math.round(row.divisiveness * 100);
  const skipPct = Math.round(row.skipRate * 100);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 bg-white rounded-2xl border border-black/5 p-2 pr-3 shadow-sm"
    >
      <div className="w-6 text-center font-bold text-slate-400 text-sm tabular-nums">#{rank}</div>
      <img
        src={row.imageUrl}
        alt={row.label}
        loading="lazy"
        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold truncate">{row.label}</h3>
          <span className="text-xs text-slate-500 tabular-nums">{row.total} vote{row.total === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden flex">
          <div className="bg-like" style={{ width: `${yesPct}%` }} />
          <div className="bg-nope" style={{ width: `${100 - yesPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
          <span>{row.yes} adopt · {row.no} pass</span>
          {sort === "most_divisive" && <span>{divisivePct}% divisive</span>}
          {sort === "most_skipped"  && <span>{skipPct}% skipped</span>}
          {(sort === "most_loved" || sort === "most_voted") && <span>{yesPct}% adopt</span>}
        </div>
      </div>
    </motion.li>
  );
}
