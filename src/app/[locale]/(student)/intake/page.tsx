"use client";
import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";

type IntakeAnswers = {
  name: string;
  dob: string;
  l1: string;
  schoolingYears: string;
  l1LiteracySelfRating: string;
};

export default function IntakePage() {
  const t = useTranslations("intake");
  const locale = useLocale();
  const router = useRouter();

  const [form, setForm] = useState<IntakeAnswers>({
    name: "",
    dob: "",
    l1: "",
    schoolingYears: "",
    l1LiteracySelfRating: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof IntakeAnswers, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const valid =
    form.name.trim() &&
    form.dob &&
    form.l1.trim() &&
    form.schoolingYears &&
    form.l1LiteracySelfRating;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake: form }),
      });

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const { attemptId } = (await res.json()) as { attemptId: string };
      router.push(`/${locale}/attempt/${attemptId}`);
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-semibold mb-1">{t("title")}</h1>
        <p className="text-sm text-gray-500 mb-6">{t("subtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("q.name.label")}
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date of birth */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("q.dob.label")}
            </label>
            <input
              type="date"
              required
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* First language */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("q.l1.label")}
            </label>
            <input
              type="text"
              required
              placeholder={t("q.l1.placeholder")}
              value={form.l1}
              onChange={(e) => set("l1", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Years of schooling */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("q.schoolingYears.label")}
            </label>
            <p className="text-xs text-gray-500 mb-1">{t("q.schoolingYears.hint")}</p>
            <input
              type="number"
              required
              min="0"
              max="20"
              value={form.schoolingYears}
              onChange={(e) => set("schoolingYears", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* L1 literacy self-rating */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t("q.l1LiteracySelfRating.label")}
            </label>
            <div className="space-y-2">
              {(["1", "2", "3", "4", "5"] as const).map((v) => (
                <label
                  key={v}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.l1LiteracySelfRating === v
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="l1LiteracySelfRating"
                    value={v}
                    checked={form.l1LiteracySelfRating === v}
                    onChange={() => set("l1LiteracySelfRating", v)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    {t(`q.l1LiteracySelfRating.options.${v}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <p className="text-xs text-gray-400">{t("privacy")}</p>

          <button
            type="submit"
            disabled={!valid || loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "…" : t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
