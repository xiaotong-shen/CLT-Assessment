"use client";
import { useState } from "react";

type Option = { id: string; text: string };

type Props = {
  payload: {
    passage?: string;
    stem: string;
    options: Option[];
  };
  onSubmit: (response: { optionId: string }) => void;
  disabled?: boolean;
};

export function McSingle({ payload, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {payload.passage && (
        <div className="bg-gray-50 border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {payload.passage}
        </div>
      )}
      <p className="font-medium">{payload.stem}</p>
      <div className="space-y-2">
        {payload.options.map((opt) => (
          <button
            key={opt.id}
            disabled={disabled}
            onClick={() => setSelected(opt.id)}
            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
              selected === opt.id
                ? "border-blue-500 bg-blue-50 text-blue-900"
                : "border-gray-200 hover:border-gray-400"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt.text}
          </button>
        ))}
      </div>
      <button
        disabled={!selected || disabled}
        onClick={() => selected && onSubmit({ optionId: selected })}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
      >
        Submit
      </button>
    </div>
  );
}
