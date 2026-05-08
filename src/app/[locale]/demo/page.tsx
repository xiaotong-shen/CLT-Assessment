"use client";
/**
 * Demo / sandbox mode — runs the full assessment engine in the browser.
 * Zero database writes. State lives in React useState only.
 * Accessible at /en/demo (dev only — redirect to home in production).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { initialStrandProgress } from "@/engine/msat";
import type { AttemptState, Level, Recommendation, Stage, Strand } from "@/engine/types";
import type { ClientItem } from "@/server/schemas/items";
import { McSingle } from "@/components/items/McSingle";
import { McMulti } from "@/components/items/McMulti";
import { Cloze } from "@/components/items/Cloze";
import { ListeningMc } from "@/components/items/ListeningMc";
import { Writing } from "@/components/items/Writing";

// Redirect non-dev users
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  window.location.replace("/");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoNext =
  | { item: ClientItem; stage: Stage; strand: Strand; state: AttemptState }
  | { done: true; recommendation: Recommendation };

// ---------------------------------------------------------------------------
// Initial demo state (dummy intake — not saved)
// ---------------------------------------------------------------------------

function makeInitialState(): AttemptState {
  return {
    attemptId: "demo",
    intake: {
      l1: "zh",
      yearsOfSchooling: 10,
      l1LiteracySelfRating: 5,
      ageYears: 16,
    },
    responses: [],
    strandProgress: initialStrandProgress(),
    startedAtMs: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

// ---------------------------------------------------------------------------
// Demo page
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const locale = useLocale();
  const [state, setState] = useState<AttemptState>(makeInitialState());
  const [current, setCurrent] = useState<{ item: ClientItem; stage: Stage; strand: Strand } | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const itemStartMs = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (!current || loading) return;
    setElapsed(0);
    itemStartMs.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - itemStartMs.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, loading]);

  const fetchNext = useCallback(async (currentState: AttemptState, response?: {
    itemId: string; correct: boolean; timeMs: number; stage: Stage; strand: Strand; level: Level;
  }) => {
    setLoading(true);
    setError(null);
    setCurrent(null);
    try {
      const res = await fetch("/api/demo/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: currentState, response }),
      });
      if (!res.ok) {
        setError("Failed to load next question.");
        return;
      }
      const data = (await res.json()) as DemoNext;
      if ("done" in data) {
        setRecommendation(data.recommendation);
      } else {
        setState(data.state);
        setCurrent({ item: data.item, stage: data.stage, strand: data.strand });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load first item on mount
  useEffect(() => {
    fetchNext(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(response: unknown) {
    if (!current || submitting) return;
    setSubmitting(true);
    const timeMs = Date.now() - itemStartMs.current;

    // Determine correctness from response (for MC: compare to correctAnswer in payload)
    const payload = current.item.payload as Record<string, unknown>;
    let correct = false;
    if (current.item.format === "mc-single") {
      correct = response === payload["correctAnswer"];
    } else if (current.item.format === "mc-multi") {
      const correct_arr = (payload["correctAnswers"] as string[]) ?? [];
      const resp_arr = (response as string[]) ?? [];
      correct = correct_arr.length === resp_arr.length &&
        correct_arr.every((a) => resp_arr.includes(a));
    } else if (current.item.format === "cloze") {
      const blanks = (payload["blanks"] as { correctAnswer: string }[]) ?? [];
      const resps = (response as string[]) ?? [];
      correct = blanks.every((b, i) =>
        b.correctAnswer.trim().toLowerCase() === (resps[i] ?? "").trim().toLowerCase()
      );
    } else if (current.item.format === "essay") {
      // Essays always treated as "correct" (advances engine) in demo
      correct = true;
    } else {
      correct = true;
    }

    const responsePayload = {
      itemId: current.item.id,
      correct,
      timeMs,
      stage: current.stage,
      strand: current.strand,
      level: current.item.level as Level,
    };

    setSubmitting(false);
    await fetchNext(state, responsePayload);
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (recommendation) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-mono px-3 py-1 rounded-full">
            🧪 DEMO — not saved
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Placement Result</p>
          <p className="text-5xl font-bold text-indigo-700">{recommendation.course}</p>
          <p className="text-sm text-gray-500">Stream: {recommendation.stream}</p>
          <div className="text-left text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            {Object.entries(recommendation.perStrandLevel).map(([strand, level]) => (
              <div key={strand} className="flex justify-between">
                <span className="capitalize">{strand}</span>
                <span className="font-medium text-gray-700">Level {level}</span>
              </div>
            ))}
          </div>
          {recommendation.flags.length > 0 && (
            <div className="text-left text-xs text-amber-700 bg-amber-50 rounded-lg p-3 space-y-1">
              {recommendation.flags.map((f) => (
                <p key={f.code}>⚑ {f.code}: {f.detail}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => { setState(makeInitialState()); setRecommendation(null); fetchNext(makeInitialState()); }}
            className="w-full mt-2 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
          >
            Restart demo
          </button>
          <a href={`/${locale}/login`} className="block text-xs text-gray-400 hover:text-gray-600 underline">
            ← Back to login
          </a>
        </div>
      </main>
    );
  }

  const estimated = current?.item.estimatedTimeSec ?? null;
  const overTime = estimated !== null && elapsed > estimated;

  // ── Assessment screen ──────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Demo banner */}
      <div className="w-full max-w-2xl mb-3 flex items-center justify-between">
        <span className="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-1 rounded">
          🧪 DEMO — no data saved
        </span>
        <a href={`/${locale}/login`} className="text-xs text-gray-400 hover:text-gray-600 underline">
          ← Exit demo
        </a>
      </div>

      <div className="w-full max-w-2xl">
        {/* Progress + timer */}
        {current && !loading && (
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
            <span className="capitalize">{current.strand}</span>
            <span>·</span>
            <span>{current.stage}</span>
            <span>·</span>
            <span>Level {current.item.level}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {estimated && (
                <span className="text-gray-300 normal-case">est. {formatTime(estimated)}</span>
              )}
              <span className={`font-mono tabular-nums ${overTime ? "text-amber-500 font-semibold" : "text-gray-400"}`}>
                {formatTime(elapsed)}
              </span>
              {overTime && <span className="text-amber-400">⏱</span>}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-6 min-h-[300px]">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="text-red-600 text-sm text-center py-8">
              {error}
              <br />
              <button onClick={() => fetchNext(state)} className="mt-3 text-blue-600 underline text-xs">
                Retry
              </button>
            </div>
          )}
          {!loading && !error && current && (
            <ItemRenderer
              item={current.item}
              onSubmit={handleSubmit}
              disabled={submitting}
              locale={locale}
            />
          )}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Item renderer (same as real attempt page, without draftKey/attemptId)
// ---------------------------------------------------------------------------

function ItemRenderer({
  item, onSubmit, disabled, locale,
}: {
  item: ClientItem;
  onSubmit: (r: unknown) => void;
  disabled: boolean;
  locale: string;
}) {
  const payload = item.payload as Record<string, unknown>;

  if (item.format === "mc-single")
    return <McSingle payload={payload as Parameters<typeof McSingle>[0]["payload"]} onSubmit={onSubmit} disabled={disabled} />;
  if (item.format === "mc-multi")
    return <McMulti payload={payload as Parameters<typeof McMulti>[0]["payload"]} onSubmit={onSubmit} disabled={disabled} />;
  if (item.format === "cloze")
    return <Cloze payload={payload as Parameters<typeof Cloze>[0]["payload"]} onSubmit={onSubmit} disabled={disabled} />;
  if (item.format === "listening-mc")
    return <ListeningMc payload={payload as Parameters<typeof ListeningMc>[0]["payload"]} onSubmit={onSubmit} disabled={disabled} />;
  if (item.format === "essay")
    return <Writing payload={payload as Parameters<typeof Writing>[0]["payload"]} onSubmit={onSubmit} disabled={disabled} locale={locale} />;

  return <p className="text-red-500 text-sm">Unknown format: {(item as { format: string }).format}</p>;
}
