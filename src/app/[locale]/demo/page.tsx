"use client";
/**
 * Demo / sandbox mode — runs the full assessment engine in the browser.
 * Zero database writes. State lives in React useState only.
 *
 * Visual style: Claude-aligned muted/beige, locked light theme,
 * larger reading-friendly typography.
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
import { ReportContent } from "@/app/[locale]/(staff)/attempt/[id]/report/ReportContent";

// Redirect non-dev users
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  window.location.replace("/");
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const C = {
  page: "#F5F4ED", // warm cream
  card: "#FFFFFF",
  cardSoft: "#FAF9F5",
  border: "#E8E4D8",
  borderStrong: "#D6D2C4",
  text: "#1A1916",
  textMuted: "#6B6759",
  textDim: "#8E8A7A",
  accent: "#2563EB",
  accentHover: "#1D4ED8",
  accentSoft: "#E9EFFC",
  accentBorder: "#C6D8F7",
  successSoft: "#E5EDDF",
  successText: "#5A7546",
  successBorder: "#C7D5BC",
  errorSoft: "#F4DFD7",
  errorText: "#A65541",
  errorBorder: "#E5C2B4",
  warningSoft: "#F5E9CB",
  warningText: "#8A6D2C",
  warningBorder: "#E0CE9D",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoExplain = {
  rule: string;
  inputs: Record<string, unknown>;
  output: Record<string, unknown>;
};

type WritingGrading = {
  scoredTraits: { trait: string; score: number; rationale: string }[];
  scoredLevel: number;
  modelRationale: string;
};

type DemoNext =
  | {
      item: ClientItem;
      stage: Stage;
      strand: Strand;
      state: AttemptState;
      explain: DemoExplain;
      lastCorrect?: boolean;
      writingGrading?: WritingGrading | null;
    }
  | {
      done: true;
      recommendation: Recommendation;
      explain: DemoExplain;
      lastCorrect?: boolean;
      writingGrading?: WritingGrading | null;
    };

type StrandFilter = Strand | "all";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function makeInitialState(filter: StrandFilter): AttemptState {
  const baseProgress = initialStrandProgress();

  // Skipped strands are marked done with a neutral level so they neither
  // block routing nor drag the placement. Listening is always skipped in the
  // demo — it has no live items yet (audio pipeline pending).
  const skipped: StrandProgress = {
    stage: "done",
    trackLevels: [],
    estimatedLevel: 3,
  };

  // Writing is a single open-response prompt in the demo (mid-level, level 3),
  // graded holistically rather than run through the multi-item adaptive flow.
  const writingActive: StrandProgress = {
    stage: "route",
    trackLevels: [3],
    estimatedLevel: null,
  };

  const strandProgress: Record<Strand, StrandProgress> = {
    reading: filter === "all" || filter === "reading" ? baseProgress.reading : skipped,
    listening: skipped,
    grammar: filter === "all" || filter === "grammar" ? baseProgress.grammar : skipped,
    writing: filter === "all" || filter === "writing" ? writingActive : skipped,
  };

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

function StrandPicker({ onPick, onSkip }: { onPick: (f: StrandFilter) => void; onSkip: () => void }) {
  const options: {
    key: StrandFilter;
    title: string;
    desc: string;
    badge?: string;
    primary?: boolean;
  }[] = [
    {
      key: "all",
      title: "Full assessment",
      desc: "Reading, grammar, and writing. (Listening is pending audio content.)",
      primary: true,
    },
    {
      key: "reading",
      title: "Reading only",
      desc: "Comprehension passages and multiple-choice questions.",
    },
    {
      key: "grammar",
      title: "Grammar only",
      desc: "Cloze and grammar multiple-choice items.",
    },
    {
      key: "writing",
      title: "Writing only",
      desc: "Free-response prompts (auto-advance in demo mode).",
    },
  ];

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: C.page, color: C.text, colorScheme: "light" }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border p-10"
        style={{ background: C.card, borderColor: C.border }}
      >
        <div
          className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full mb-6"
          style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accentBorder}` }}
        >
          DEMO · no data saved
        </div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: C.text }}>
          What would you like to test?
        </h1>
        <p className="text-base mt-3 mb-8 leading-relaxed" style={{ color: C.textMuted, maxWidth: "44ch" }}>
          Pick a strand and the routing tree on the right will visualize how
          the engine places the student as questions are answered.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onPick(opt.key)}
              className="text-left rounded-xl border p-5 transition focus:outline-none focus-visible:ring-2"
              style={{
                background: opt.primary ? C.accentSoft : C.cardSoft,
                borderColor: opt.primary ? C.accentBorder : C.border,
                color: C.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = opt.primary ? C.accent : C.borderStrong;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = opt.primary ? C.accentBorder : C.border;
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-base">{opt.title}</span>
                {opt.badge && (
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{
                      background: C.warningSoft,
                      color: C.warningText,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {opt.badge}
                  </span>
                )}
              </div>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: C.textMuted }}>
                {opt.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Dev shortcut — skip to results */}
        <div
          className="mt-6 pt-5 border-t flex items-center justify-between"
          style={{ borderColor: C.border }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: C.textMuted }}>Dev shortcut</p>
            <p className="text-xs mt-0.5" style={{ color: C.textDim }}>
              Skip the assessment entirely — generate random responses and jump to the placement result.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border transition focus:outline-none focus-visible:ring-2"
            style={{
              color: C.accent,
              borderColor: C.accentBorder,
              background: C.card,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.accentSoft;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = C.card;
            }}
          >
            Skip to results →
          </button>
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
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [writingGrading, setWritingGrading] = useState<WritingGrading | null>(null);
  const itemStartMs = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
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
        raw: unknown;
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
        setLastCorrect(
          typeof data.lastCorrect === "boolean" ? data.lastCorrect : null
        );
        // Grading only arrives on the writing response — keep it once seen.
        if (data.writingGrading) setWritingGrading(data.writingGrading);
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

  function start(filter: StrandFilter) {
    const initial = makeInitialState(filter);
    setStrandFilter(filter);
    setState(initial);
    setRecommendation(null);
    setLastExplain(null);
    setLastCorrect(null);
    setWritingGrading(null);
    fetchNext(initial);
  }

  const [downloading, setDownloading] = useState(false);

  // Strands the student actually answered (listening is never shown — no
  // content yet). Falls back to the core three if responses are unavailable.
  function assessedStrands(): Strand[] {
    const seen = new Set((state?.responses ?? []).map((r) => r.strand));
    const order: Strand[] = ["reading", "grammar", "writing"];
    const list = order.filter((s) => seen.has(s));
    return list.length > 0 ? list : order;
  }

  async function downloadPdf() {
    if (!recommendation || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/demo/report.pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation,
          studentName: "Demo Student",
          assessmentDate: new Date().toISOString(),
          assessedStrands: assessedStrands(),
          essayGrading: writingGrading,
        }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "placement-report-demo-student.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function restart() {
    setStrandFilter(null);
    setState(null);
    setCurrent(null);
    setRecommendation(null);
    setLastExplain(null);
    setLastCorrect(null);
    setWritingGrading(null);
    setError(null);
  }

  async function handleSubmit(response: unknown) {
    if (!current || submitting || !state) return;
    setSubmitting(true);
    const timeMs = Date.now() - itemStartMs.current;

    const responsePayload = {
      itemId: current.item.id,
      raw: response,
      timeMs,
      stage: current.stage,
      strand: current.strand,
      level: current.item.level as Level,
    };

    setSubmitting(false);
    await fetchNext(state, responsePayload);
  }

  async function skipToResults() {
    setLoading(true);
    setError(null);
    setStrandFilter("all");
    try {
      const res = await fetch("/api/demo/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accuracy: 0.6 }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || "Failed to generate results.");
        return;
      }
      const data = await res.json();
      if (data.done) {
        setState(data.state);
        setRecommendation(data.recommendation);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Strand picker ──────────────────────────────────────────────────────────
  if (strandFilter === null) {
    return <StrandPicker onPick={start} onSkip={skipToResults} />;
  }

  // ── Done screen — real print-ready report (reuses the staff ReportContent) ───
  if (recommendation) {
    return (
      <main
        className="min-h-screen p-6 print:bg-white print:p-0"
        style={{ background: C.page, colorScheme: "light" }}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Demo controls — hidden on print/PDF */}
          <div className="flex items-center gap-3 print:hidden">
            <span
              className="text-xs font-mono px-2.5 py-1 rounded"
              style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accentBorder}` }}
            >
              DEMO · not saved
            </span>
            <button
              onClick={restart}
              className="ml-auto text-sm underline transition"
              style={{ color: C.textMuted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
            >
              Restart demo
            </button>
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="text-sm font-medium px-4 py-2 rounded-lg text-white transition disabled:opacity-60"
              style={{ background: "#2563EB" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1D4ED8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563EB")}
            >
              {downloading ? "Generating…" : "⬇ Download PDF"}
            </button>
          </div>

          <ReportContent
            attemptId="demo"
            rec={recommendation}
            studentName="Demo Student"
            assessmentDate={new Date()}
            locale={locale}
            demo
            assessedStrands={assessedStrands()}
            essayGrading={writingGrading ?? undefined}
          />

          <footer className="text-center text-xs pb-8 print:pb-4" style={{ color: C.textDim }}>
            <p>
              Demo placement · Engine {recommendation.engineVersion} · CLT Assessment Platform
            </p>
          </footer>
        </div>
      </main>
    );
  }

  const estimated = current?.item.estimatedTimeSec ?? null;
  const overTime = estimated !== null && elapsed > estimated;
  const isListening = strandFilter === "listening" || current?.strand === "listening";

  // ── Assessment screen ──────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen p-4 lg:p-8"
      style={{ background: C.page, color: C.text, colorScheme: "light" }}
    >
      {/* Top banner */}
      <div className="max-w-[1400px] mx-auto mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-mono px-2.5 py-1 rounded"
            style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accentBorder}` }}
          >
            DEMO · no data saved
          </span>
          <span className="text-sm capitalize hidden sm:inline" style={{ color: C.textMuted }}>
            {strandFilter === "all" ? "full assessment" : `${strandFilter} only`}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={restart}
            className="underline transition"
            style={{ color: C.textMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
          >
            Change strand
          </button>
          <a
            href={`/${locale}/login`}
            className="underline transition"
            style={{ color: C.textDim }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.textDim)}
          >
            Exit demo
          </a>
        </div>
      </div>

      {isListening && (
        <div
          className="max-w-[1400px] mx-auto mb-5 rounded-lg px-4 py-3 text-sm leading-relaxed"
          style={{ background: C.warningSoft, color: C.warningText, border: `1px solid ${C.warningBorder}` }}
        >
          <span className="font-semibold">Listening pipeline under construction.</span>{" "}
          Audio for these items has not been generated yet — the routing logic
          works, but you may see items without playable audio. Use the
          on-screen text fallback to answer.
        </div>
      )}

      {/* Two-column grid — wider main column */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8">
        {/* LEFT — question card */}
        <div>
          {/* Last-answer feedback pill */}
          {lastCorrect !== null && !loading && current && (
            <div
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full"
              style={
                lastCorrect
                  ? {
                      background: C.successSoft,
                      color: C.successText,
                      border: `1px solid ${C.successBorder}`,
                    }
                  : {
                      background: C.errorSoft,
                      color: C.errorText,
                      border: `1px solid ${C.errorBorder}`,
                    }
              }
              role="status"
              aria-live="polite"
            >
              {lastCorrect ? "✓ Previous answer correct" : "✗ Previous answer wrong"}
            </div>
          )}

          {/* Question metadata strip */}
          {current && !loading && (
            <div
              className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider"
              style={{ color: C.textDim, letterSpacing: "0.1em" }}
            >
              <span className="capitalize" style={{ color: C.text }}>
                {current.strand}
              </span>
              <span style={{ color: C.borderStrong }}>·</span>
              <span>{current.stage}</span>
              <span style={{ color: C.borderStrong }}>·</span>
              <span>Level {current.item.level}</span>
              <div className="ml-auto flex items-center gap-2 normal-case" style={{ letterSpacing: "0" }}>
                {estimated && (
                  <span style={{ color: C.textDim }}>
                    est. {formatTime(estimated)}
                  </span>
                )}
                <span
                  className="font-mono tabular-nums"
                  style={{
                    color: overTime ? C.warningText : C.textMuted,
                    fontWeight: overTime ? 600 : 400,
                  }}
                >
                  {formatTime(elapsed)}
                </span>
              </div>
            </div>
          )}

          {/* Question card */}
          <div
            className="rounded-2xl border p-8 lg:p-10 min-h-[400px]"
            style={{ background: C.card, borderColor: C.border }}
          >
            {loading && (
              <div className="flex items-center justify-center h-64">
                <div
                  className="w-8 h-8 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: C.border,
                    borderTopColor: C.accent,
                  }}
                />
              </div>
            )}
            {error && (
              <div
                className="text-center py-12 text-base"
                style={{ color: C.errorText }}
              >
                {error}
                <br />
                <button
                  onClick={() => state && fetchNext(state)}
                  className="mt-4 underline text-sm"
                  style={{ color: C.accent }}
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
        <aside
          className="rounded-2xl border p-6 lg:sticky lg:top-6 lg:self-start max-h-[calc(100vh-3rem)] overflow-y-auto"
          style={{ background: C.card, borderColor: C.border }}
        >
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
    <p style={{ color: "#A65541" }}>
      Unknown format: {(item as { format: string }).format}
    </p>
  );
}
