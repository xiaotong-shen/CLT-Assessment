"use client";
/**
 * Vertical decision-tree visualization of the MSAT routing engine.
 * Designed for non-technical viewers — uses plain English, color, and
 * highlighted paths to show how the student's answers determine placement.
 *
 * Palette: Claude-style muted/beige, light theme only.
 */
import type { AttemptState, Level, Stage, Strand } from "@/engine/types";

// ---------------------------------------------------------------------------
// Palette tokens (kept inline so this file is self-contained)
// ---------------------------------------------------------------------------
const C = {
  text: "#1A1916",
  textMuted: "#6B6759",
  textDim: "#8E8A7A",
  border: "#E8E4D8",
  bg: "#FAF9F5",
  bgSoft: "#F2EFE5",
  accent: "#C15F3C", // Claude coral
  accentSoft: "#F4E8DD",
  accentBorder: "#E0C6B3",
  successSoft: "#E5EDDF",
  successText: "#5A7546",
  successDot: "#7A9B5E",
  errorSoft: "#F4DFD7",
  errorText: "#A65541",
  errorDot: "#C26B52",
  pendingDot: "#D6D2C4",
  activeDot: "#C15F3C",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  state: AttemptState;
  activeStrand: Strand | null;
  activeStage: Stage | null;
  ruleText?: string;
}

// ---------------------------------------------------------------------------
// Helpers — match msat.ts internal logic
// ---------------------------------------------------------------------------

function routeBranch(routeAccuracy: number | null): {
  label: string;
  levels: Level[];
  key: "high" | "mid" | "low";
} {
  if (routeAccuracy === null) {
    return { label: "Mid track", levels: [2, 3, 4], key: "mid" };
  }
  if (routeAccuracy >= 0.75) return { label: "Hard track", levels: [4, 5], key: "high" };
  if (routeAccuracy <= 0.25) return { label: "Easy track", levels: [1, 2], key: "low" };
  return { label: "Mid track", levels: [2, 3, 4], key: "mid" };
}

function strandResponses(state: AttemptState, strand: Strand) {
  return state.responses.filter((r) => r.strand === strand);
}

function accuracyAt(responses: { correct: boolean }[]): number | null {
  if (responses.length === 0) return null;
  return responses.filter((r) => r.correct).length / responses.length;
}

// ---------------------------------------------------------------------------
// Atomic components
// ---------------------------------------------------------------------------

type DotState = "correct" | "wrong" | "pending" | "active";

function StatusDot({ state }: { state: DotState }) {
  const style: React.CSSProperties = (() => {
    if (state === "correct")
      return { background: C.successDot };
    if (state === "wrong")
      return { background: C.errorDot };
    if (state === "active")
      return {
        background: C.activeDot,
        boxShadow: `0 0 0 3px ${C.accentSoft}`,
      };
    return { background: C.pendingDot };
  })();
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-3 h-3 rounded-full ${state === "active" ? "animate-pulse" : ""}`}
      style={style}
    />
  );
}

function SlotRow({
  slots,
  filled,
  current,
}: {
  slots: number;
  filled: { correct: boolean }[];
  current: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 mt-2" role="list" aria-label="Question slots">
      {Array.from({ length: slots }).map((_, i) => {
        const r = filled[i];
        if (r) {
          return (
            <span key={i} role="listitem" aria-label={r.correct ? "Correct" : "Wrong"}>
              <StatusDot state={r.correct ? "correct" : "wrong"} />
            </span>
          );
        }
        const isNext = current && i === filled.length;
        return (
          <span key={i} role="listitem" aria-label={isNext ? "Current question" : "Pending"}>
            <StatusDot state={isNext ? "active" : "pending"} />
          </span>
        );
      })}
    </div>
  );
}

function VerticalConnector() {
  return (
    <div
      className="w-px h-5 mx-auto"
      style={{ background: C.border }}
      aria-hidden="true"
    />
  );
}

function StageNode({
  title,
  subtitle,
  status,
  children,
}: {
  title: string;
  subtitle?: string;
  status: "locked" | "active" | "complete";
  children?: React.ReactNode;
}) {
  const styles: React.CSSProperties = (() => {
    if (status === "active")
      return {
        background: C.accentSoft,
        borderColor: C.accentBorder,
      };
    if (status === "complete")
      return {
        background: C.successSoft,
        borderColor: "#C7D5BC",
      };
    return {
      background: C.bg,
      borderColor: C.border,
    };
  })();
  const titleColor =
    status === "active"
      ? C.accent
      : status === "complete"
        ? C.successText
        : C.textDim;
  return (
    <div
      className="rounded-lg border p-3.5"
      style={styles}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: titleColor, letterSpacing: "0.08em" }}
      >
        {title}
      </div>
      {subtitle && (
        <div className="text-xs mt-1 leading-relaxed" style={{ color: C.textMuted }}>
          {subtitle}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-strand tree
// ---------------------------------------------------------------------------

function StrandTree({
  strand,
  state,
  isActive,
  activeStage,
}: {
  strand: Strand;
  state: AttemptState;
  isActive: boolean;
  activeStage: Stage | null;
}) {
  const progress = state.strandProgress[strand];
  const all = strandResponses(state, strand);
  const routeR = all.filter((r) => r.stage === "route");
  const targetR = all.filter((r) => r.stage === "target");
  const confirmR = all.filter((r) => r.stage === "confirm");

  type Status = "locked" | "active" | "complete";
  const routeStatus: Status =
    progress.stage === "route" ? "active" : "complete";
  const targetStatus: Status =
    progress.stage === "target"
      ? "active"
      : progress.stage === "confirm" || progress.stage === "done"
        ? "complete"
        : "locked";
  const confirmStatus: Status =
    progress.stage === "confirm"
      ? "active"
      : progress.stage === "done"
        ? "complete"
        : "locked";
  const doneStatus: Status = progress.stage === "done" ? "complete" : "locked";

  const routeAcc = accuracyAt(routeR);
  const branch = routeBranch(routeAcc);
  const routeBranchKnown = routeR.length === 4;

  const headerStyle: React.CSSProperties = isActive
    ? { background: C.accent, color: "#FFF" }
    : progress.stage === "done"
      ? { background: C.successText, color: "#FFF" }
      : { background: C.bgSoft, color: C.textMuted };

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: C.border, background: "#FFF" }}
    >
      <div
        className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-between"
        style={{ ...headerStyle, letterSpacing: "0.1em" }}
      >
        <span>{strand}</span>
        {progress.stage === "done" && progress.estimatedLevel && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            Level {progress.estimatedLevel}
          </span>
        )}
      </div>

      <div className="p-4 space-y-0">
        {/* ROUTE */}
        <StageNode
          title="1 · Route"
          subtitle="Sample at levels 2–4 to gauge starting ability"
          status={routeStatus === "active" && activeStage === "route" ? "active" : routeStatus}
        >
          <SlotRow
            slots={4}
            filled={routeR}
            current={isActive && activeStage === "route"}
          />
          {routeR.length > 0 && (
            <div className="mt-2.5 text-xs" style={{ color: C.textMuted }}>
              <span className="font-mono">{Math.round((routeAcc ?? 0) * 100)}% accuracy</span>
              <span className="mx-1.5" style={{ color: C.textDim }}>·</span>
              <span>{routeR.filter((r) => r.correct).length} / {routeR.length} correct</span>
            </div>
          )}
        </StageNode>

        <VerticalConnector />

        {/* BRANCH NODE */}
        <div
          className="rounded-lg border p-3.5"
          style={{ background: C.bgSoft, borderColor: C.border }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-wider mb-2.5"
            style={{ color: C.textMuted, letterSpacing: "0.08em" }}
          >
            Decision · Which track next?
          </div>
          <div className="grid grid-cols-3 gap-2">
            <BranchPill
              label="Easy"
              levels="1, 2"
              rule="≤ 25%"
              active={routeBranchKnown && branch.key === "low"}
              dim={routeBranchKnown && branch.key !== "low"}
            />
            <BranchPill
              label="Mid"
              levels="2, 3, 4"
              rule="25–75%"
              active={routeBranchKnown && branch.key === "mid"}
              dim={routeBranchKnown && branch.key !== "mid"}
            />
            <BranchPill
              label="Hard"
              levels="4, 5"
              rule="≥ 75%"
              active={routeBranchKnown && branch.key === "high"}
              dim={routeBranchKnown && branch.key !== "high"}
            />
          </div>
          {!routeBranchKnown && (
            <p className="text-[11px] mt-2.5 italic" style={{ color: C.textDim }}>
              Branch decided after 4 route items.
            </p>
          )}
        </div>

        <VerticalConnector />

        {/* TARGET */}
        <StageNode
          title="2 · Target"
          subtitle={
            progress.trackLevels.length && (progress.stage === "target" || targetR.length > 0)
              ? `Probing levels ${progress.trackLevels.join(", ")}`
              : "Estimate the level using the 70% / 50% rule"
          }
          status={targetStatus === "active" && activeStage === "target" ? "active" : targetStatus}
        >
          <SlotRow
            slots={4}
            filled={targetR}
            current={isActive && activeStage === "target"}
          />
        </StageNode>

        <VerticalConnector />

        {/* CONFIRM */}
        <StageNode
          title="3 · Confirm"
          subtitle={
            progress.stage === "confirm" && progress.estimatedLevel
              ? `Testing levels ${Math.max(1, progress.estimatedLevel - 1)} & ${Math.min(6, progress.estimatedLevel + 1)}`
              : "Verify by checking one level above and below"
          }
          status={confirmStatus === "active" && activeStage === "confirm" ? "active" : confirmStatus}
        >
          <SlotRow
            slots={4}
            filled={confirmR}
            current={isActive && activeStage === "confirm"}
          />
        </StageNode>

        <VerticalConnector />

        {/* DONE */}
        <StageNode
          title="4 · Final Level"
          subtitle={
            progress.estimatedLevel
              ? `Placement: Level ${progress.estimatedLevel}`
              : "Awaiting completion"
          }
          status={doneStatus}
        />
      </div>
    </div>
  );
}

function BranchPill({
  label,
  levels,
  rule,
  active,
  dim,
}: {
  label: string;
  levels: string;
  rule: string;
  active: boolean;
  dim: boolean;
}) {
  const style: React.CSSProperties = active
    ? {
        background: C.accent,
        color: "#FFF",
        borderColor: C.accent,
      }
    : dim
      ? {
          background: "#FFF",
          color: C.textDim,
          borderColor: C.border,
          opacity: 0.55,
        }
      : { background: "#FFF", color: C.text, borderColor: C.border };
  return (
    <div
      className="rounded-md border px-2 py-2 text-center"
      style={style}
    >
      <div className="font-semibold text-xs">{label}</div>
      <div className="font-mono text-[11px] mt-0.5">{levels}</div>
      <div className="text-[10px] mt-0.5" style={{ opacity: 0.85 }}>
        {rule}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const STRAND_ORDER: Strand[] = ["reading", "listening", "grammar", "writing"];

export function RoutingTree({ state, activeStrand, activeStage, ruleText }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold" style={{ color: C.text }}>
          Routing
        </h3>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: C.textMuted }}>
          How the engine is placing this student. Highlighted path follows
          their answers so far.
        </p>
      </div>

      {ruleText && (
        <div
          className="rounded-lg border p-3.5 text-xs leading-relaxed"
          style={{
            background: C.accentSoft,
            borderColor: C.accentBorder,
            color: "#5A3527",
          }}
        >
          <div className="font-semibold mb-1.5 uppercase tracking-wider text-[10px]" style={{ letterSpacing: "0.08em" }}>
            What just happened
          </div>
          <div>{ruleText}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]" style={{ color: C.textMuted }}>
        <span className="flex items-center gap-1.5"><StatusDot state="correct" /> correct</span>
        <span className="flex items-center gap-1.5"><StatusDot state="wrong" /> wrong</span>
        <span className="flex items-center gap-1.5"><StatusDot state="active" /> current</span>
        <span className="flex items-center gap-1.5"><StatusDot state="pending" /> pending</span>
      </div>

      <div className="space-y-3">
        {STRAND_ORDER.map((strand) => (
          <StrandTree
            key={strand}
            strand={strand}
            state={state}
            isActive={activeStrand === strand}
            activeStage={activeStrand === strand ? activeStage : null}
          />
        ))}
      </div>
    </div>
  );
}
