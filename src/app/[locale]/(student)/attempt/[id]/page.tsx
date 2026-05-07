"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import type { ClientItem } from "@/server/schemas/items";
import { McSingle } from "@/components/items/McSingle";
import { McMulti } from "@/components/items/McMulti";
import { Cloze } from "@/components/items/Cloze";
import { ListeningMc } from "@/components/items/ListeningMc";
import { Writing } from "@/components/items/Writing";
import type { Stage, Strand } from "@/engine/types";

type NextItemResponse =
  | { done: true }
  | { item: ClientItem; stage: Stage; strand: Strand };

// ---------------------------------------------------------------------------
// Item elapsed-time hook
// ---------------------------------------------------------------------------

function useElapsedTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  return { elapsed, startRef };
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AttemptPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const router = useRouter();

  const [current, setCurrent] = useState<{ item: ClientItem; stage: Stage; strand: Strand } | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemStartMs = useRef<number>(Date.now());
  const { elapsed, startRef } = useElapsedTimer(!!current && !loading);

  const estimated = current?.item.estimatedTimeSec ?? null;
  const overTime = estimated !== null && elapsed > estimated;

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCurrent(null);
    try {
      const res = await fetch(`/api/attempts/${id}/next`);
      if (!res.ok) {
        setError("Failed to load next question.");
        return;
      }
      const data = (await res.json()) as NextItemResponse;
      if ("done" in data) {
        setDone(true);
        router.push(`/${locale}/attempt/${id}/complete`);
      } else {
        setCurrent(data);
        itemStartMs.current = Date.now();
        startRef.current = Date.now();
      }
    } catch {
      setError("Network error. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [id, locale, router, startRef]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  async function handleSubmit(response: unknown) {
    if (!current || submitting) return;
    setSubmitting(true);
    const timeMs = Date.now() - itemStartMs.current;

    // Clear auto-save draft on submit
    if (current.item.format === "essay") {
      try {
        localStorage.removeItem(`draft_${id}_${current.item.id}`);
      } catch {
        // localStorage may be unavailable (private browsing, etc.)
      }
    }

    try {
      const res = await fetch(`/api/attempts/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: current.item.id, response, timeMs }),
      });
      if (!res.ok) {
        setError("Failed to record response.");
        setSubmitting(false);
        return;
      }
      await fetchNext();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Redirecting…</p>
      </main>
    );
  }

  const isEssay = current?.item.format === "essay";

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress + timer header */}
        {current && (
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
            <span className="capitalize">{current.strand}</span>
            <span>·</span>
            <span>{current.stage}</span>
            <span>·</span>
            <span>Level {current.item.level}</span>

            {/* Elapsed timer */}
            <div className="ml-auto flex items-center gap-1.5">
              {estimated && (
                <span className="text-gray-300 normal-case">
                  est. {formatTime(estimated)}
                </span>
              )}
              <span
                className={`font-mono tabular-nums ${
                  overTime ? "text-amber-500 font-semibold" : "text-gray-400"
                }`}
              >
                {formatTime(elapsed)}
              </span>
              {overTime && (
                <span className="text-amber-400" title="Over estimated time">
                  ⏱
                </span>
              )}
            </div>
          </div>
        )}

        {/* Grading notice for essay items */}
        {isEssay && submitting && (
          <div className="mb-3 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            {locale === "zh-Hans"
              ? "正在评分您的作文，请稍候…"
              : "Grading your essay — this may take a moment…"}
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
              <button
                onClick={fetchNext}
                className="mt-3 text-blue-600 underline text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && current && (
            <ItemRenderer
              item={current.item}
              attemptId={id}
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
// Item renderer
// ---------------------------------------------------------------------------

function ItemRenderer({
  item,
  attemptId,
  onSubmit,
  disabled,
  locale,
}: {
  item: ClientItem;
  attemptId: string;
  onSubmit: (r: unknown) => void;
  disabled: boolean;
  locale: string;
}) {
  const payload = item.payload as Record<string, unknown>;

  if (item.format === "mc-single") {
    return (
      <McSingle
        payload={payload as Parameters<typeof McSingle>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }
  if (item.format === "mc-multi") {
    return (
      <McMulti
        payload={payload as Parameters<typeof McMulti>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }
  if (item.format === "cloze") {
    return (
      <Cloze
        payload={payload as Parameters<typeof Cloze>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }
  if (item.format === "listening-mc") {
    return (
      <ListeningMc
        payload={payload as Parameters<typeof ListeningMc>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }
  if (item.format === "essay") {
    return (
      <Writing
        payload={payload as Parameters<typeof Writing>[0]["payload"]}
        onSubmit={onSubmit}
        disabled={disabled}
        locale={locale}
        draftKey={`draft_${attemptId}_${item.id}`}
      />
    );
  }

  // Exhaustive fallback — item.format is `never` here if all branches are handled
  const _format: string = (item as { format: string }).format;
  return <p className="text-red-500 text-sm">Unknown item format: {_format}</p>;
}
