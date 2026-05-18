import { useEffect, useState } from "react";
import { fetchMatches } from "../api.js";

export default function MatchesView({ sessionId, onBack }) {
  const [matches, setMatches] = useState([]);
  const [threshold, setThreshold] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch matches when threshold changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchMatches(sessionId, threshold);
        console.log(`[FRONTEND] Fetched matches: threshold=${threshold}, count=${data.matches?.length || 0}, data=`, data);
        if (!cancelled) {
          setMatches(data.matches || []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[FRONTEND] Error:", e.message);
          setError(e.message);
          setMatches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, threshold]);

  // Poll every 5 seconds for real-time updates
  useEffect(() => {
    const id = setInterval(() => {
      (async () => {
        try {
          const data = await fetchMatches(sessionId, threshold);
          console.log(`[POLL] threshold=${threshold}, count=${data.matches?.length || 0}`);
          setMatches(data.matches || []);
        } catch (e) {
          console.error("Poll error:", e.message);
        }
      })();
    }, 5000);
    return () => clearInterval(id);
  }, [sessionId, threshold]);

  const handleThresholdChange = (e) => {
    setThreshold(Number(e.target.value));
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 max-w-md w-full mx-auto border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Your Matches ❤️</h2>
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Threshold Slider */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Show items with ≤ {threshold}% yes votes
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={threshold}
            onChange={handleThresholdChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Count display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
          <p className="text-sm font-semibold text-blue-900">
            {matches.length} match{matches.length === 1 ? '' : 'es'} found at {threshold}% threshold
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 max-w-md w-full mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading matches...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm">
            Error loading matches: {error}
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-4xl mb-4">💔</span>
            <p className="text-slate-600 text-center">
              No matches yet at {threshold}% threshold.
              <br />
              Try lowering the threshold or voting "yes" on more dogs!
            </p>
          </div>
        )}

        {!loading && !error && matches.length > 0 && (
          <div className="grid gap-4">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 pb-4 max-w-md w-full mx-auto border-t border-slate-200">
        <button
          onClick={onBack}
          className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
        >
          Back to Swipe
        </button>
      </footer>
    </div>
  );
}

function MatchCard({ match }) {
  const yesPercent = Math.round(match.yesRate * 100);
  const barWidth = Math.max(0, Math.min(100, match.yesRate * 100));

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition">
      <div className="aspect-[3/2] overflow-hidden bg-slate-100">
        <img
          src={match.imageUrl}
          alt={match.label}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3">
        <h3 className="font-bold text-slate-800 mb-1">{match.label}</h3>
        {match.description && (
          <p className="text-xs text-slate-600 mb-2 line-clamp-2">
            {match.description}
          </p>
        )}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Yes rate</span>
            <span className="font-semibold text-like">{yesPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-like h-full transition-all"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 text-center">
            {match.yes} yes, {match.no} no ({match.total} total votes)
          </div>
        </div>
      </div>
    </div>
  );
}
