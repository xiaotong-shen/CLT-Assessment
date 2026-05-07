"use client";
import { useState, type FormEvent } from "react";

const COURSES = [
  "ESLAO", "ESLBO", "ESLCO", "ESLDO", "ESLEO",
  "ELDAO", "ELDBO", "ELDCO", "ELDDO", "ELDEO",
  "Mainstream",
] as const;

type Stream = "esl" | "eld" | "mainstream";

interface Props {
  attemptId: string;
  currentCourse: string;
  currentStream: Stream;
  existingOverride?: {
    course: string;
    stream: Stream;
    reason: string | null;
    createdAt: Date;
  } | null;
}

export function OverrideForm({
  attemptId,
  currentCourse,
  currentStream,
  existingOverride,
}: Props) {
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState(currentCourse);
  const [stream, setStream] = useState<Stream>(currentStream);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/attempts/${attemptId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, stream, reason }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save override.");
        return;
      }
      setSaved(true);
      setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (saved || existingOverride) {
    const display = saved
      ? { course, stream, reason }
      : {
          course: existingOverride!.course,
          stream: existingOverride!.stream,
          reason: existingOverride!.reason ?? "",
        };
    return (
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
        <p className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">
          Specialist Override Applied
        </p>
        <p className="text-gray-700">
          <span className="font-mono bg-white border px-1.5 py-0.5 rounded text-sm">
            {display.course}
          </span>{" "}
          <span className="text-gray-400">·</span>{" "}
          <span className="capitalize">{display.stream}</span>
        </p>
        {display.reason && (
          <p className="text-xs text-amber-700 mt-1 italic">"{display.reason}"</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Override recommendation…
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="border border-amber-300 rounded-lg p-4 bg-amber-50 space-y-3"
        >
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            Override Engine Recommendation
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Course</label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {COURSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Stream</label>
              <select
                value={stream}
                onChange={(e) => setStream(e.target.value as Stream)}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="esl">ESL</option>
                <option value="eld">ELD</option>
                <option value="mainstream">Mainstream</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">
              Reason for override <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe your clinical judgment or additional context…"
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !reason.trim()}
              className="text-sm bg-amber-600 text-white rounded px-4 py-1.5 font-medium hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save Override"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
