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
    <div className="space-y-6 text-[#1A1916]">
      {payload.passage && (
        <div
          className="rounded-lg border bg-[#FAF9F5] border-[#E8E4D8] p-5 text-base leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
        >
          {payload.passage}
        </div>
      )}
      <p className="text-lg font-medium leading-relaxed">{payload.stem}</p>
      <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
        {payload.options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => setSelected(opt.id)}
              className={`w-full text-left px-5 py-4 rounded-lg border text-base leading-relaxed transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                isSelected
                  ? "border-[#C15F3C] bg-[#F4E8DD] text-[#1A1916]"
                  : "border-[#E8E4D8] bg-white hover:border-[#D6D2C4] hover:bg-[#FAF9F5]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block w-4 h-4 mr-3 rounded-full border-2 align-middle ${
                  isSelected
                    ? "border-[#C15F3C] bg-[#C15F3C] ring-2 ring-white ring-inset"
                    : "border-[#D6D2C4]"
                }`}
              />
              {opt.text}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!selected || disabled}
        onClick={() => selected && onSubmit({ optionId: selected })}
        className="w-full bg-[#C15F3C] hover:bg-[#A04E2E] text-white rounded-lg py-3 text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2"
      >
        Submit
      </button>
    </div>
  );
}
