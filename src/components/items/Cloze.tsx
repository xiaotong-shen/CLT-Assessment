"use client";
import { useState } from "react";

type Blank = { id: string; placeholder?: string };

type Props = {
  payload: {
    template: string; // uses {{blank_id}} placeholders
    blanks: Blank[];
  };
  onSubmit: (response: Record<string, string>) => void;
  disabled?: boolean;
};

export function Cloze({ payload, onSubmit, disabled }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(payload.blanks.map((b) => [b.id, ""]))
  );

  const allFilled = payload.blanks.every((b) => answers[b.id]?.trim());

  // Render template with inline inputs substituted
  const parts = payload.template.split(/(\{\{[^}]+\}\})/);

  return (
    <div className="space-y-6 text-[#1A1916]">
      <div className="text-base leading-loose whitespace-pre-wrap">
        {parts.map((part, i) => {
          const match = part.match(/^\{\{(.+)\}\}$/);
          if (match) {
            const id = match[1]!;
            const blank = payload.blanks.find((b) => b.id === id);
            return (
              <input
                key={i}
                type="text"
                disabled={disabled}
                value={answers[id] ?? ""}
                placeholder={blank?.placeholder ?? "___"}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [id]: e.target.value }))
                }
                className="inline-block border-b-2 border-[#D6D2C4] focus:border-[#C15F3C] outline-none text-center w-28 mx-1 px-1 py-0.5 text-base disabled:opacity-50 bg-transparent transition-colors"
              />
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
      <button
        disabled={!allFilled || disabled}
        onClick={() => onSubmit(answers)}
        className="w-full bg-[#C15F3C] hover:bg-[#A04E2E] text-white rounded-lg py-3 text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2"
      >
        Submit
      </button>
    </div>
  );
}
