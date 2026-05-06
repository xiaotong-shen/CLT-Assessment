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

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      }
    } catch {
      setError("Network error. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [id, locale, router]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  async function handleSubmit(response: unknown) {
    if (!current || submitting) return;
    setSubmitting(true);
    const timeMs = Date.now() - itemStartMs.current;

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
      setCurrent(null);
      await fetchNext();
    } catch {
      setError("Network error. Please try again.");
    } finally {
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

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress header */}
        {current && (
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide">
            <span>{current.strand}</span>
            <span>·</span>
            <span>{current.stage}</span>
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
      />
    );
  }

  // Exhaustive check — item.format is `never` here if all cases are handled above
  const _format: string = (item as { format: string }).format;
  return <p className="text-red-500 text-sm">Unknown item format: {_format}</p>;
}
