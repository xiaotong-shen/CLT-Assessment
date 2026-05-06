"use client";
import { useState } from "react";

type Props = {
  payload: {
    promptText: string;
    minWords?: number;
    maxWords?: number;
  };
  onSubmit: (response: { text: string }) => void;
  disabled?: boolean;
  locale?: string;
};

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function Writing({ payload, onSubmit, disabled, locale = "en" }: Props) {
  const [text, setText] = useState("");
  const wordCount = countWords(text);
  const minWords = payload.minWords ?? 50;
  const maxWords = payload.maxWords;
  const ready = wordCount >= minWords && (!maxWords || wordCount <= maxWords);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border rounded-lg p-4 text-sm leading-relaxed">
        {payload.promptText}
      </div>
      <textarea
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-y"
        placeholder={locale === "zh-Hans" ? "在这里输入您的回答…" : "Type your response here…"}
      />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {wordCount} {locale === "zh-Hans" ? "词" : "words"}
          {maxWords ? ` / ${maxWords}` : ""}
        </span>
        <span>
          {locale === "zh-Hans"
            ? `至少 ${minWords} 词`
            : `Minimum ${minWords} words`}
        </span>
      </div>
      <button
        disabled={!ready || disabled}
        onClick={() => onSubmit({ text })}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {locale === "zh-Hans" ? "提交" : "Submit"}
      </button>
    </div>
  );
}
