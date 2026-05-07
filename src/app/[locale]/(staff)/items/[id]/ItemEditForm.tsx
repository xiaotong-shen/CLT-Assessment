"use client";
import { useState } from "react";

type Item = {
  id: string;
  strand: string;
  level: number;
  subskill: string;
  format: string;
  status: string;
  culturalContextFlag: boolean;
  estimatedTimeSec: number | null;
  payload: unknown;
};

type Props = {
  item: Item;
  locale: string;
};

const STATUS_OPTIONS = ["drafted", "reviewed", "live", "retired"] as const;

export function ItemEditForm({ item, locale }: Props) {
  const [status, setStatus] = useState(item.status);
  const [level, setLevel] = useState(String(item.level));
  const [subskill, setSubskill] = useState(item.subskill);
  const [culturalFlag, setCulturalFlag] = useState(item.culturalContextFlag);
  const [estimatedTimeSec, setEstimatedTimeSec] = useState(
    item.estimatedTimeSec ? String(item.estimatedTimeSec) : ""
  );
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(item.payload, null, 2)
  );
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validatePayload(text: string): boolean {
    try {
      JSON.parse(text);
      setPayloadError(null);
      return true;
    } catch {
      setPayloadError("Invalid JSON");
      return false;
    }
  }

  async function handleSave() {
    if (!validatePayload(payloadText)) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const body: Record<string, unknown> = {
      level: Number(level),
      subskill,
      status,
      culturalContextFlag: culturalFlag,
      payload: JSON.parse(payloadText),
    };
    if (estimatedTimeSec) body["estimatedTimeSec"] = Number(estimatedTimeSec);

    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        setError(data.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                status === s
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Subskill */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subskill</label>
        <input
          type="text"
          value={subskill}
          onChange={(e) => setSubskill(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
      </div>

      {/* Estimated time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Estimated time (seconds)
        </label>
        <input
          type="number"
          min={1}
          value={estimatedTimeSec}
          onChange={(e) => setEstimatedTimeSec(e.target.value)}
          className="w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
      </div>

      {/* Cultural flag */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={culturalFlag}
          onChange={(e) => setCulturalFlag(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-gray-700">Cultural context flag</span>
      </label>

      {/* Payload JSON */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payload (JSON)
        </label>
        <textarea
          rows={16}
          value={payloadText}
          onChange={(e) => {
            setPayloadText(e.target.value);
            validatePayload(e.target.value);
          }}
          className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${
            payloadError ? "border-red-400" : ""
          }`}
        />
        {payloadError && (
          <p className="text-red-500 text-xs mt-1">{payloadError}</p>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          disabled={saving || !!payloadError}
          onClick={handleSave}
          className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-green-600 text-sm">Saved ✓</span>}
      </div>
    </div>
  );
}
