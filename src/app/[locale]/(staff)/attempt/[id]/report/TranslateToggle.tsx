"use client";
import { useState } from "react";

interface TranslationResult {
  reasoning: string[];
  flagDetails: string[];
  traitRationales: string[];
  modelRationale: string | null;
}

interface Props {
  attemptId: string;
  onTranslated: (result: TranslationResult | null) => void;
  isTranslated: boolean;
}

export function TranslateToggle({ attemptId, onTranslated, isTranslated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (isTranslated) {
      onTranslated(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang: "zh-Hans" }),
      });
      if (!res.ok) {
        setError("Translation failed. Please try again.");
        return;
      }
      const data = (await res.json()) as TranslationResult;
      onTranslated(data);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        disabled={loading}
        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded disabled:opacity-50"
      >
        {loading
          ? "翻译中…"
          : isTranslated
          ? "Show English"
          : "中文版 (AI Translation)"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
