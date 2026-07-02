"use client";
import { useState } from "react";

type Option = { id: string; text: string };

type Props = {
  payload: {
    passage?: string;
    stem: string;
    options: Option[];
  };
  onSubmit: (response: { optionIds: string[] }) => void;
  disabled?: boolean;
};

export function McMulti({ payload, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6 text-[#1A1916]">
      {payload.passage && (
        <div
          className="rounded-lg border bg-[#FAF9F5] border-[#E8E4D8] p-5 text-base leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
        >
          {payload.passage}
        </div>
      )}
      <div>
        <p className="text-lg font-medium leading-relaxed">{payload.stem}</p>
        <p className="text-sm mt-1.5 text-[#8E8A7A]">Select all that apply.</p>
      </div>
      <div className="space-y-2.5" role="group" aria-label="Answer options">
        {payload.options.map((opt) => {
          const isSelected = selected.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => toggle(opt.id)}
              className={`w-full text-left px-5 py-4 rounded-lg border text-base leading-relaxed transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                isSelected
                  ? "border-[#C15F3C] bg-[#F4E8DD] text-[#1A1916]"
                  : "border-[#E8E4D8] bg-white hover:border-[#D6D2C4] hover:bg-[#FAF9F5]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex items-center justify-center w-4 h-4 mr-3 border-2 rounded align-middle ${
                  isSelected ? "bg-[#C15F3C] border-[#C15F3C] text-white" : "border-[#D6D2C4]"
                }`}
              >
                {isSelected && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M2 6.5L5 9.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={selected.size === 0 || disabled}
        onClick={() => onSubmit({ optionIds: [...selected] })}
        className="w-full bg-[#C15F3C] hover:bg-[#A04E2E] text-white rounded-lg py-3 text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2"
      >
        Submit
      </button>
    </div>
  );
}
