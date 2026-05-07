"use client";
import { useState, useEffect, useRef } from "react";

type Props = {
  payload: {
    promptTextEn: string;
    promptTextZh?: string;
    minWords?: number;
    maxWords?: number;
  };
  onSubmit: (response: { text: string }) => void;
  disabled?: boolean;
  locale?: string;
  /** localStorage key for auto-saving draft. If omitted, drafts are not persisted. */
  draftKey?: string;
};

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Auto-save debounce delay in ms
const AUTOSAVE_DELAY = 1500;

export function Writing({ payload, onSubmit, disabled, locale = "en", draftKey }: Props) {
  const [text, setText] = useState("");
  const [savedIndicator, setSavedIndicator] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = countWords(text);
  const minWords = payload.minWords ?? 50;
  const maxWords = payload.maxWords;
  const ready = wordCount >= minWords && (!maxWords || wordCount <= maxWords);
  const promptText =
    locale === "zh-Hans" && payload.promptTextZh
      ? payload.promptTextZh
      : payload.promptTextEn;

  // Restore draft from localStorage on mount
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setText(saved);
    } catch {
      // localStorage unavailable — ignore
    }
  }, [draftKey]);

  // Auto-save draft to localStorage, debounced
  function handleChange(newText: string) {
    setText(newText);

    if (!draftKey) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, newText);
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2000);
      } catch {
        // ignore
      }
    }, AUTOSAVE_DELAY);
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border rounded-lg p-4 text-sm leading-relaxed text-gray-900">
        {promptText}
      </div>
      <textarea
        disabled={disabled}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={8}
        className="w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-y"
        placeholder={locale === "zh-Hans" ? "在这里输入您的回答…" : "Type your response here…"}
      />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-2">
          <span>
            {wordCount} {locale === "zh-Hans" ? "词" : "words"}
            {maxWords ? ` / ${maxWords}` : ""}
          </span>
          {/* Auto-save indicator */}
          {draftKey && savedIndicator && (
            <span className="text-green-500">
              {locale === "zh-Hans" ? "✓ 已保存草稿" : "✓ Draft saved"}
            </span>
          )}
          {draftKey && !savedIndicator && text.length > 0 && (
            <span className="text-gray-300">
              {locale === "zh-Hans" ? "自动保存已开启" : "Auto-save on"}
            </span>
          )}
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
