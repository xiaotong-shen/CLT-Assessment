"use client";
import { useState } from "react";
import { TranslateToggle } from "./TranslateToggle";
import type { Recommendation, Flag, Strand } from "@/engine/types";

// ---------------------------------------------------------------------------
// Static label maps (client-side)
// ---------------------------------------------------------------------------

const STRAND_LABELS: Record<string, string> = {
  reading: "Reading",
  listening: "Listening",
  grammar: "Grammar / Language Structures",
  writing: "Writing",
};

const STRAND_LABELS_ZH: Record<string, string> = {
  reading: "阅读",
  listening: "听力",
  grammar: "语法 / 语言结构",
  writing: "写作",
};

const LEVEL_DESCRIPTORS: Record<number, string> = {
  1: "Beginning (STEP 1–2) — Communicates using isolated words and simple phrases",
  2: "Developing (STEP 2–3) — Produces simple sentences with support",
  3: "Expanding (STEP 3–4) — Communicates in simple and some complex sentences",
  4: "Consolidating (STEP 4–5) — Uses varied sentence structures with increasing accuracy",
  5: "Bridging (STEP 5–6) — Approaches grade-level language proficiency",
};

const LEVEL_DESCRIPTORS_ZH: Record<number, string> = {
  1: "初学阶段（STEP 1–2）— 使用单词和简短词组进行交流",
  2: "发展阶段（STEP 2–3）— 在支持下能写出简单句子",
  3: "扩展阶段（STEP 3–4）— 能写出简单句及部分复杂句",
  4: "巩固阶段（STEP 4–5）— 使用多样句式，准确性逐步提高",
  5: "过渡阶段（STEP 5–6）— 英语能力接近年级水平",
};

const FLAG_LABELS: Record<string, { label: string; note: string }> = {
  "uneven-profile": {
    label: "Uneven Language Profile",
    note: "Scores vary significantly across strands. Human review recommended to understand skill gaps.",
  },
  "stage-3-ambiguous": {
    label: "Borderline Placement",
    note: "Results place the student near a boundary between levels. Specialist review is advised.",
  },
  rushed: {
    label: "Short Response Times",
    note: "Several responses were submitted very quickly. Consider whether this student was able to engage fully.",
  },
  "rapid-clicks": {
    label: "Rapid Answer Selection",
    note: "Multiple-choice responses were selected unusually fast. Results may not be reliable.",
  },
  "writing-blank": {
    label: "Writing Not Completed",
    note: "The writing task was not submitted or was submitted without content. Writing level could not be assessed.",
  },
  "audio-skipped": {
    label: "Listening Task Not Completed",
    note: "Audio items were skipped or answered immediately. Listening level may be underestimated.",
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EssayGrading {
  scoredTraits: { trait: string; score: number; rationale: string }[];
  scoredLevel: number;
  modelRationale: string;
}

interface TranslationResult {
  reasoning: string[];
  flagDetails: string[];
  traitRationales: string[];
  modelRationale: string | null;
}

interface Props {
  attemptId: string;
  rec: Recommendation;
  studentName: string;
  assessmentDate: Date;
  essayGrading?: EssayGrading;
  locale: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportContent({
  attemptId,
  rec,
  studentName,
  assessmentDate,
  essayGrading,
  locale,
}: Props) {
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const isZh = !!translation;

  const displayReasoning = translation?.reasoning ?? rec.reasoning ?? [];
  const warnFlags = rec.flags.filter(
    (f: Flag) => f.severity === "warn" || f.severity === "review"
  );
  const strandLabels = isZh ? STRAND_LABELS_ZH : STRAND_LABELS;
  const levelDescriptors = isZh ? LEVEL_DESCRIPTORS_ZH : LEVEL_DESCRIPTORS;

  return (
    <div className="space-y-6">
      {/* Navigation (hidden on print) */}
      <div className="flex items-center gap-3 print:hidden">
        <a href=".." className="text-sm text-blue-600 hover:underline">
          ← Review
        </a>
        <div className="ml-auto flex items-center gap-3">
          <TranslateToggle
            attemptId={attemptId}
            onTranslated={setTranslation}
            isTranslated={isZh}
          />
          <button
            onClick={() => window.print()}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded shadow-sm"
          >
            {isZh ? "🖨 打印 / 存为 PDF" : "🖨 Print / Save PDF"}
          </button>
        </div>
      </div>

      {/* Print-only school header */}
      <div className="hidden print:block border-b-2 border-gray-800 pb-3 mb-2">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
          ESL Placement Assessment · Confidential
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Generated: {new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Report header */}
      <section className="bg-white rounded-xl shadow p-6 print:shadow-none print:rounded-none print:border-b print:border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
              {isZh ? "英语安置评估" : "ESL Placement Assessment"}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{studentName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isZh ? "评估日期：" : "Assessed: "}
              {assessmentDate.toLocaleDateString(isZh ? "zh-CN" : "en-CA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">
              {isZh ? "建议安置" : "Recommended Placement"}
            </p>
            <p className="text-3xl font-bold text-indigo-700">{rec.course}</p>
            <p className="text-sm text-gray-500 capitalize">{rec.stream}</p>
          </div>
        </div>

        {/* Reasoning */}
        {displayReasoning.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
            <p className="font-medium text-gray-700 mb-1">
              {isZh ? "评估摘要" : "Assessment Summary"}
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              {displayReasoning.slice(0, 5).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Per-strand levels */}
      <section className="bg-white rounded-xl shadow p-6 print:shadow-none print:rounded-none">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          {isZh ? "语言技能概况" : "Language Skills Profile"}
        </h2>
        <div className="space-y-3">
          {(Object.entries(rec.perStrandLevel) as [Strand, number][]).map(
            ([strand, level]) => (
              <div key={strand}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 font-medium">
                    {strandLabels[strand] ?? strand}
                  </span>
                  <span className="text-sm font-bold text-indigo-700">
                    {isZh ? `第 ${level} 级` : `Level ${level}`}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${(level / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {levelDescriptors[level] ?? `Level ${level}`}
                </p>
              </div>
            )
          )}
        </div>
      </section>

      {/* Essay writing detail */}
      {essayGrading && (
        <section className="bg-white rounded-xl shadow p-6 print:shadow-none print:rounded-none">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {isZh ? "写作评估详情" : "Writing Assessment Detail"}
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {essayGrading.scoredTraits.map((t, i) => {
              const rationale = translation?.traitRationales[i] ?? t.rationale;
              return (
                <div key={t.trait} className="border rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700 capitalize">
                      {t.trait.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <span
                      className={`font-bold text-sm ${
                        t.score >= 4
                          ? "text-green-600"
                          : t.score >= 3
                          ? "text-yellow-600"
                          : "text-red-500"
                      }`}
                    >
                      {t.score}/5
                    </span>
                  </div>
                  <p className="text-gray-500 leading-tight">{rationale}</p>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
            <span className="font-medium text-gray-500">
              {isZh
                ? `总体评价（第 ${essayGrading.scoredLevel} 级）：`
                : `Overall (Level ${essayGrading.scoredLevel}): `}
            </span>
            {translation?.modelRationale ?? essayGrading.modelRationale}
          </div>
        </section>
      )}

      {/* Flags */}
      {warnFlags.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6 print:rounded-none">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">
            {isZh ? "⚑ 建议专业审查" : "⚑ Specialist Review Recommended"}
          </h2>
          <div className="space-y-3">
            {warnFlags.map((f: Flag, i) => {
              const info = FLAG_LABELS[f.code];
              const detail = translation?.flagDetails[i] ?? (info?.note ?? f.detail);
              return (
                <div key={f.code} className="text-sm">
                  <p className="font-medium text-amber-900">{info?.label ?? f.code}</p>
                  <p className="text-amber-700 text-xs leading-relaxed">{detail}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AI translation notice */}
      {isZh && (
        <p className="text-xs text-gray-300 text-center print:text-left">
          * 本报告由AI辅助翻译，如有疑问请以英文原版为准。
        </p>
      )}
    </div>
  );
}
