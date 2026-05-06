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
    <div className="space-y-4">
      <div className="text-sm leading-loose">
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
                className="inline-block border-b-2 border-gray-400 focus:border-blue-500 outline-none text-center w-28 mx-1 px-1 py-0.5 text-sm disabled:opacity-50"
              />
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
      <button
        disabled={!allFilled || disabled}
        onClick={() => onSubmit(answers)}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </div>
  );
}
