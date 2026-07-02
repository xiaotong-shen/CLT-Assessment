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
    <div className="space-y-5 text-[#1A1916]">
      <div
        className="rounded-lg border bg-[#FAF9F5] border-[#E8E4D8] p-5 text-base leading-relaxed whitespace-pre-wrap"
        style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}
      >
        {promptText}
      </div>
      <textarea
        disabled={disabled}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={8}
        className="w-full border border-[#E8E4D8] rounded-lg px-4 py-3 text-base text-[#1A1916] leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-[#C15F3C] focus:border-[#C15F3C] disabled:opacity-50 resize-y transition-colors"
        placeholder={locale === "zh-Hans" ? "在这里输入您的回答…" : "Type your response here…"}
      />
      <div className="flex items-center justify-between text-xs" style={{ color: "#8E8A7A" }}>
        <span className="flex items-center gap-2">
          <span>
            {wordCount} {locale === "zh-Hans" ? "词" : "words"}
            {maxWords ? ` / ${maxWords}` : ""}
          </span>
          {/* Auto-save indicator */}
          {draftKey && savedIndicator && (
            <span style={{ color: "#5A7546" }}>
              {locale === "zh-Hans" ? "✓ 已保存草稿" : "✓ Draft saved"}
            </span>
          )}
          {draftKey && !savedIndicator && text.length > 0 && (
            <span style={{ color: "#D6D2C4" }}>
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
        className="w-full bg-[#C15F3C] hover:bg-[#A04E2E] text-white rounded-lg py-3 text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C15F3C] focus-visible:ring-offset-2"
      >
        {locale === "zh-Hans" ? "提交" : "Submit"}
      </button>
    </div>
  );
}
