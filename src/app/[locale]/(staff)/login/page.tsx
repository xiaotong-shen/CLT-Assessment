"use client";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

const IS_DEV = process.env.NODE_ENV !== "production";

export default function StaffLoginPage() {
  const t = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bypassLoading, setBypassLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      window.location.href = `/${document.documentElement.lang}/queue`;
    }
  }

  async function handleDevBypass() {
    setError(null);
    setBypassLoading(true);
    const result = await signIn("dev-bypass", { redirect: false });
    setBypassLoading(false);
    if (result?.error) {
      setError("Dev bypass failed. Are you running in development mode?");
    } else {
      window.location.href = `/${document.documentElement.lang}/queue`;
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <h1 className="text-xl font-semibold mb-6">Staff Login</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || bypassLoading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t("loading") : "Sign in"}
          </button>
        </form>

        {/* Dev-only shortcuts — never rendered in production */}
        {IS_DEV && (
          <div className="mt-6 pt-6 border-t border-dashed border-amber-300 space-y-2">
            <p className="text-xs font-mono text-amber-700 mb-3">
              ⚠ DEV MODE — these buttons are hidden in production
            </p>
            <button
              type="button"
              onClick={handleDevBypass}
              disabled={loading || bypassLoading}
              className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg py-2 text-sm font-medium border border-amber-300 disabled:opacity-50"
            >
              {bypassLoading ? "Signing in…" : "🔓 Sign in as Dev Admin"}
            </button>
            <a
              href="/en/intake"
              className="block w-full text-center bg-green-50 hover:bg-green-100 text-green-800 rounded-lg py-2 text-sm font-medium border border-green-300"
            >
              🧑‍🎓 Try assessment as student
            </a>
            <p className="text-xs text-gray-400 pt-1">
              Admin: <span className="font-mono">admin@school.ca</span> / <span className="font-mono">123</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
