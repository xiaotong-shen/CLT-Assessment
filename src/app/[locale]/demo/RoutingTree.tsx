"use client";
/**
 * Vertical decision-tree visualization of the MSAT routing engine.
 * Designed for non-technical viewers — uses plain English, color, and
 * highlighted paths to show exactly how the student's answers
 * are determining their placement.
 */
import type { AttemptState, Level, Stage, Strand } from "@/engine/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  state: AttemptState;
  /** Which strand the engine is currently serving (highlighted in tree). */
  activeStrand: Strand | null;
  activeStage: Stage | null;
  /** Plain-English description of the most recent decision. */
  ruleText?: string;
}

// ---------------------------------------------------------------------------
// Helpers — match msat.ts internal logic so the tree shows the same path
// ---------------------------------------------------------------------------

const ROUTE_LEVELS: Level[] = [2, 3, 4];

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

function StatusDot({
  state,
}: {
  state: "correct" | "wrong" | "pending" | "active";
}) {
  const cls =
    state === "correct"
      ? "bg-green-500"
      : state === "wrong"
        ? "bg-red-500"
        : state === "active"
          ? "bg-blue-500 animate-pulse ring-2 ring-blue-200"
          : "bg-gray-200";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
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
    <div className="flex items-center gap-1 mt-1">
      {Array.from({ length: slots }).map((_, i) => {
        const r = filled[i];
        if (r) {
          return (
            <StatusDot
              key={i}
              state={r.correct ? "correct" : "wrong"}
            />
          );
        }
        const isNext = current && i === filled.length;
        return <StatusDot key={i} state={isNext ? "active" : "pending"} />;
      })}
    </div>
  );
}

function VerticalConnector({ active }: { active: boolean }) {
  return (
    <div
      className={`w-0.5 h-5 mx-auto ${active ? "bg-blue-400" : "bg-gray-200"}`}
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
  const ring =
    status === "active"
      ? "border-blue-400 bg-blue-50"
      : status === "complete"
        ? "border-green-300 bg-green-50"
        : "border-gray-200 bg-gray-50";
  const titleColor =
    status === "active"
      ? "text-blue-800"
      : status === "complete"
        ? "text-green-800"
        : "text-gray-400";
  return (
    <div className={`rounded-lg border ${ring} p-3 text-xs`}>
      <div className={`font-semibold uppercase tracking-wide ${titleColor}`}>
        {title}
      </div>
      {subtitle && <div className="text-gray-500 mt-0.5">{subtitle}</div>}
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

  // Stage statuses
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

  // Route accuracy → which branch will fire
  const routeAcc = accuracyAt(routeR);
  const branch = routeBranch(routeAcc);
  const routeBranchKnown = routeR.length === 4;

  // Strand header color
  const headerCls = isActive
    ? "bg-blue-600 text-white"
    : progress.stage === "done"
      ? "bg-green-600 text-white"
      : "bg-gray-200 text-gray-600";

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${headerCls} flex items-center justify-between`}
      >
        <span>{strand}</span>
        {progress.stage === "done" && progress.estimatedLevel && (
          <span className="text-[10px] bg-white/20 rounded px-1.5 py-0.5">
            Final: Level {progress.estimatedLevel}
          </span>
        )}
      </div>

      <div className="p-3 space-y-0">
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
            <div className="mt-2 text-[11px] text-gray-600">
              Accuracy: <span className="font-mono">{Math.round((routeAcc ?? 0) * 100)}%</span>
              {" "}· {routeR.filter((r) => r.correct).length}/{routeR.length} correct
            </div>
          )}
        </StageNode>

        <VerticalConnector active={true} />

        {/* BRANCH NODE — three options */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
          <div className="font-semibold text-amber-900 mb-2">
            Decision: which track next?
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <BranchPill
              label="Easy"
              levels="[1, 2]"
              rule="≤ 25%"
              active={routeBranchKnown && branch.key === "low"}
              dim={routeBranchKnown && branch.key !== "low"}
            />
            <BranchPill
              label="Mid"
              levels="[2, 3, 4]"
              rule="25–75%"
              active={routeBranchKnown && branch.key === "mid"}
              dim={routeBranchKnown && branch.key !== "mid"}
            />
            <BranchPill
              label="Hard"
              levels="[4, 5]"
              rule="≥ 75%"
              active={routeBranchKnown && branch.key === "high"}
              dim={routeBranchKnown && branch.key !== "high"}
            />
          </div>
          {!routeBranchKnown && (
            <p className="text-[10px] text-amber-700 mt-2 italic">
              Branch decided after 4 route items.
            </p>
          )}
        </div>

        <VerticalConnector active={targetStatus !== "locked"} />

        {/* TARGET */}
        <StageNode
          title="2 · Target"
          subtitle={
            progress.trackLevels.length && (progress.stage === "target" || targetR.length > 0)
              ? `Probing levels ${progress.trackLevels.join(", ")}`
              : "Estimate the level using ~70% / 50% rule"
          }
          status={targetStatus === "active" && activeStage === "target" ? "active" : targetStatus}
        >
          <SlotRow
            slots={4}
            filled={targetR}
            current={isActive && activeStage === "target"}
          />
        </StageNode>

        <VerticalConnector active={confirmStatus !== "locked"} />

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

        <VerticalConnector active={doneStatus === "complete"} />

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
  const cls = active
    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
    : dim
      ? "bg-white text-gray-300 border-gray-200"
      : "bg-white text-gray-700 border-gray-300";
  return (
    <div className={`rounded border ${cls} px-2 py-1.5 text-center`}>
      <div className="font-semibold text-[11px]">{label}</div>
      <div className={`font-mono text-[10px] ${active ? "text-white/90" : ""}`}>
        {levels}
      </div>
      <div className={`text-[9px] mt-0.5 ${active ? "text-white/80" : "text-gray-400"}`}>
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
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700">Routing Tree</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          How the engine is placing this student. Highlighted path = current
          trajectory based on answers so far.
        </p>
      </div>

      {ruleText && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-900 leading-relaxed">
          <div className="font-semibold mb-1">📍 What just happened</div>
          {ruleText}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><StatusDot state="correct" /> correct</span>
        <span className="flex items-center gap-1"><StatusDot state="wrong" /> wrong</span>
        <span className="flex items-center gap-1"><StatusDot state="active" /> current</span>
        <span className="flex items-center gap-1"><StatusDot state="pending" /> pending</span>
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
