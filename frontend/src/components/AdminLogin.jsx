import { useState } from "react";

export default function AdminLogin({ onLogin }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Simulate a brief auth delay for realism
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (id === "admin" && password === "admin123") {
      onLogin();
      setId("");
      setPassword("");
    } else {
      setError("Invalid ID or password");
      setPassword("");
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-4 pt-4 pb-2 max-w-md w-full mx-auto border-b border-slate-200">
        <h2 className="text-2xl font-bold">Admin Access 🔐</h2>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 max-w-md w-full mx-auto">
        <form
          onSubmit={handleSubmit}
          className="w-full space-y-4"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Admin ID
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter admin ID"
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-slate-100"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !id || !password}
            className="w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition disabled:bg-slate-300"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </main>
    </div>
  );
}
