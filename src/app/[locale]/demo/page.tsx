"use client";
/**
 * Demo / sandbox mode — runs the full assessment engine in the browser.
 * Zero database writes. State lives in React useState only.
 * Accessible at /en/demo (dev only — redirect to home in production).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { initialStrandProgress } from "@/engine/msat";
import type {
  AttemptState,
  Level,
  Recommendation,
  Stage,
  Strand,
  StrandProgress,
} from "@/engine/types";
import type { ClientItem } from "@/server/schemas/items";
import { McSingle } from "@/components/items/McSingle";
import { McMulti } from "@/components/items/McMulti";
import { Cloze } from "@/components/items/Cloze";
import { ListeningMc } from "@/components/items/ListeningMc";
import { Writing } from "@/components/items/Writing";
import { RoutingTree } from "./RoutingTree";

// Redirect non-dev users
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  window.location.replace("/");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoExplain = {
  rule: string;
  inputs: Record<string, unknown>;
  output: Record<string, unknown>;
};

type DemoNext =
  | {
      item: ClientItem;
      stage: Stage;
      strand: Strand;
      state: AttemptState;
      explain: DemoExplain;
    }
  | { done: true; recommendation: Recommendation; explain: DemoExplain };

type StrandFilter = Strand | "all";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function makeInitialState(filter: StrandFilter): AttemptState {
  const baseProgress = initialStrandProgress();

  // If a single strand is chosen, mark all others as already complete.
  let strandProgress = baseProgress;
  if (filter !== "all") {
    const otherDefaults: StrandProgress = {
      stage: "done",
      trackLevels: [],
      estimatedLevel: 3,
    };
    strandProgress = {
      reading: filter === "reading" ? baseProgress.reading : otherDefaults,
      listening: filter === "listening" ? baseProgress.listening : otherDefaults,
      grammar: filter === "grammar" ? baseProgress.grammar : otherDefaults,
      writing: filter === "writing" ? baseProgress.writing : otherDefaults,
    };
  }

  return {
    attemptId: "demo",
    intake: {
      l1: "zh",
      yearsOfSchooling: 10,
      l1LiteracySelfRating: 5,
      ageYears: 16,
    },
    responses: [],
    strandProgress,
    startedAtMs: Date.now(),
  };
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

// ---------------------------------------------------------------------------
// Strand picker
// ---------------------------------------------------------------------------

function StrandPicker({ onPick }: { onPick: (f: StrandFilter) => void }) {
  const options: {
    key: StrandFilter;
    title: string;
    desc: string;
    badge?: string;
    color: string;
  }[] = [
    {
      key: "all",
      title: "Full assessment",
      desc: "All four strands: reading → listening → grammar → writing",
      color: "border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900",
    },
    {
      key: "reading",
      title: "Reading only",
      desc: "Comprehension passages & multiple-choice",
      color: "border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900",
    },
    {
      key: "grammar",
      title: "Grammar only",
      desc: "Cloze + grammar multiple-choice",
      color: "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900",
    },
    {
      key: "writing",
      title: "Writing only",
      desc: "Free-response prompts (auto-advances in demo)",
      color: "border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900",
    },
    {
      key: "listening",
      title: "Listening only",
      desc: "Audio comprehension",
      badge: "🚧 Under construction",
      color: "border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow p-8">
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-mono px-3 py-1 rounded-full mb-4">
          🧪 DEMO — no data saved
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          Pick what to test
        </h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          The routing tree on the right will visualize how the engine places
          the student as questions are answered.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onPick(opt.key)}
              className={`text-left rounded-lg border-2 p-4 transition ${opt.color}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">{opt.title}</span>
                {opt.badge && (
                  <span className="text-[10px] font-mono">{opt.badge}</span>
                )}
              </div>
              <p className="text-xs mt-1 opacity-80">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Demo page
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const locale = useLocale();
  const [strandFilter, setStrandFilter] = useState<StrandFilter | null>(null);
  const [state, setState] = useState<AttemptState | null>(null);
  const [current, setCurrent] = useState<{
    item: ClientItem;
    stage: Stage;
    strand: Strand;
  } | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastExplain, setLastExplain] = useState<DemoExplain | null>(null);
  const itemStartMs = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer — reset itemStartMs on each new item; interval drives elapsed updates
  useEffect(() => {
    if (!current || loading) return;
    itemStartMs.current = Date.now();
    const tick = () => {
      setElapsed(Math.floor((Date.now() - itemStartMs.current) / 1000));
    };
    const initial = setTimeout(tick, 0);
    timerRef.current = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [current, loading]);

  const fetchNext = useCallback(
    async (
      currentState: AttemptState,
      response?: {
        itemId: string;
        correct: boolean;
        timeMs: number;
        stage: Stage;
        strand: Strand;
        level: Level;
      }
    ) => {
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
          const errBody = await res.json().catch(() => ({}));
          setError(errBody.error || "Failed to load next question.");
          return;
        }
        const data = (await res.json()) as DemoNext;
        setLastExplain(data.explain ?? null);
        if ("done" in data) {
          setRecommendation(data.recommendation);
        } else {
          setState(data.state);
          setCurrent({
            item: data.item,
            stage: data.stage,
            strand: data.strand,
          });
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Start the demo when a strand is picked
  function start(filter: StrandFilter) {
    const initial = makeInitialState(filter);
    setStrandFilter(filter);
    setState(initial);
    setRecommendation(null);
    setLastExplain(null);
    fetchNext(initial);
  }

  function restart() {
    setStrandFilter(null);
    setState(null);
    setCurrent(null);
    setRecommendation(null);
    setLastExplain(null);
    setError(null);
  }

  async function handleSubmit(response: unknown) {
    if (!current || submitting || !state) return;
    setSubmitting(true);
    const timeMs = Date.now() - itemStartMs.current;

    const payload = current.item.payload as Record<string, unknown>;
    let correct = false;
    if (current.item.format === "mc-single") {
      correct = response === payload["correctAnswer"];
    } else if (current.item.format === "mc-multi") {
      const correct_arr = (payload["correctAnswers"] as string[]) ?? [];
      const resp_arr = (response as string[]) ?? [];
      correct =
        correct_arr.length === resp_arr.length &&
        correct_arr.every((a) => resp_arr.includes(a));
    } else if (current.item.format === "cloze") {
      const blanks = (payload["blanks"] as { correctAnswer: string }[]) ?? [];
      const resps = (response as string[]) ?? [];
      correct = blanks.every(
        (b, i) =>
          b.correctAnswer.trim().toLowerCase() ===
          (resps[i] ?? "").trim().toLowerCase()
      );
    } else if (current.item.format === "essay") {
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

  // ── Strand picker (initial state) ──────────────────────────────────────────
  if (strandFilter === null) {
    return <StrandPicker onPick={start} />;
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (recommendation) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-mono px-3 py-1 rounded-full">
            🧪 DEMO — not saved
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">
            Placement Result
          </p>
          <p className="text-5xl font-bold text-indigo-700">
            {recommendation.course}
          </p>
          <p className="text-sm text-gray-500">Stream: {recommendation.stream}</p>
          <div className="text-left text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
            {Object.entries(recommendation.perStrandLevel).map(
              ([strand, level]) => (
                <div key={strand} className="flex justify-between">
                  <span className="capitalize">{strand}</span>
                  <span className="font-medium text-gray-700">Level {level}</span>
                </div>
              )
            )}
          </div>
          {recommendation.flags.length > 0 && (
            <div className="text-left text-xs text-amber-700 bg-amber-50 rounded-lg p-3 space-y-1">
              {recommendation.flags.map((f) => (
                <p key={f.code}>
                  ⚑ {f.code}: {f.detail}
                </p>
              ))}
            </div>
          )}
          <button
            onClick={restart}
            className="w-full mt-2 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
          >
            Restart demo
          </button>
          <a
            href={`/${locale}/login`}
            className="block text-xs text-gray-400 hover:text-gray-600 underline"
          >
            ← Back to login
          </a>
        </div>
      </main>
    );
  }

  const estimated = current?.item.estimatedTimeSec ?? null;
  const overTime = estimated !== null && elapsed > estimated;
  const isListening = strandFilter === "listening" || current?.strand === "listening";

  // ── Assessment screen — two-column layout ──────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 p-4 lg:p-6">
      {/* Top banner */}
      <div className="max-w-7xl mx-auto mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-1 rounded">
            🧪 DEMO — no data saved
          </span>
          <span className="text-xs text-gray-500 capitalize hidden sm:inline">
            · {strandFilter === "all" ? "full assessment" : `${strandFilter} only`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={restart}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            Change strand
          </button>
          <a
            href={`/${locale}/login`}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            ← Exit demo
          </a>
        </div>
      </div>

      {isListening && (
        <div className="max-w-7xl mx-auto mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
          🚧 <span className="font-semibold">Listening pipeline under construction.</span>{" "}
          Audio for these items has not been generated yet — the routing logic
          works, but you may see items without playable audio. Use the on-screen
          text fallback to answer.
        </div>
      )}

      {/* Two-column grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6">
        {/* LEFT — question card */}
        <div>
          {current && !loading && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
              <span className="capitalize">{current.strand}</span>
              <span>·</span>
              <span>{current.stage}</span>
              <span>·</span>
              <span>Level {current.item.level}</span>
              <div className="ml-auto flex items-center gap-1.5">
                {estimated && (
                  <span className="text-gray-300 normal-case">
                    est. {formatTime(estimated)}
                  </span>
                )}
                <span
                  className={`font-mono tabular-nums ${overTime ? "text-amber-500 font-semibold" : "text-gray-400"}`}
                >
                  {formatTime(elapsed)}
                </span>
                {overTime && <span className="text-amber-400">⏱</span>}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow p-6 min-h-[320px]">
            {loading && (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {error && (
              <div className="text-red-600 text-sm text-center py-8">
                {error}
                <br />
                <button
                  onClick={() => state && fetchNext(state)}
                  className="mt-3 text-blue-600 underline text-xs"
                >
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

        {/* RIGHT — routing tree */}
        <aside className="bg-white rounded-xl shadow p-5 lg:sticky lg:top-4 lg:self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
          {state && (
            <RoutingTree
              state={state}
              activeStrand={current?.strand ?? null}
              activeStage={current?.stage ?? null}
              ruleText={lastExplain?.rule}
            />
          )}
        </aside>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Item renderer
// ---------------------------------------------------------------------------

function ItemRenderer({
  item,
  onSubmit,
  disabled,
  locale,
}: {
  item: ClientItem;
  onSubmit: (r: unknown) => void;
  disabled: boolean;
  locale: string;
}) {
  const payload = item.payload as Record<string, unknown>;

  if (item.format === "mc-single")
    return (
      <McSingle
        payload={payload as Parameters<typeof McSingle>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  if (item.format === "mc-multi")
    return (
      <McMulti
        payload={payload as Parameters<typeof McMulti>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  if (item.format === "cloze")
    return (
      <Cloze
        payload={payload as Parameters<typeof Cloze>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  if (item.format === "listening-mc")
    return (
      <ListeningMc
        payload={payload as Parameters<typeof ListeningMc>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  if (item.format === "essay")
    return (
      <Writing
        payload={payload as Parameters<typeof Writing>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
        locale={locale}
      />
    );

  return (
    <p className="text-red-500 text-sm">
      Unknown format: {(item as { format: string }).format}
    </p>
  );
}
