import { useEffect, useState } from "react";
import { fetchAnalytics } from "../api.js";

export default function AnalyticsView({ onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchAnalytics();
        if (!cancelled) {
          setAnalytics(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    poll();

    // Poll every 5 seconds for live updates
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 max-w-md w-full mx-auto border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Analytics 📊</h2>
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Updates every 5 seconds
        </p>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 max-w-md w-full mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading analytics...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm">
            Error loading analytics: {error}
          </div>
        )}

        {!loading && !error && analytics && (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Total Sessions"
              value={analytics.totalSessions}
              icon="👥"
            />
            <StatCard
              label="Total Swipes"
              value={analytics.totalSwipes}
              icon="👆"
            />
            <StatCard
              label="Avg Swipes/Session"
              value={analytics.avgSwipesPerSession.toFixed(1)}
              icon="📈"
            />
            <StatCard
              label="Unique Days"
              value={analytics.uniqueDays}
              icon="📅"
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 pb-4 max-w-md w-full mx-auto border-t border-slate-200">
        <button
          onClick={onBack}
          className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
        >
          Back
        </button>
      </footer>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 text-center hover:shadow-md transition">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-accent mb-1">{value}</div>
      <div className="text-xs text-slate-600 font-medium">{label}</div>
    </div>
  );
}
