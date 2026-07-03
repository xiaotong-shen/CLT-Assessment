/**
 * Static, in-memory item bank loaded from the seed JSON.
 *
 * The demo assessment reads items from here instead of the database, so it
 * runs with no DB connection at all (the Supabase project can be paused and
 * the assessment still works). The shape mirrors the `items` table columns the
 * demo route uses.
 */
import readingRaw from "../../db/seed/reading.json";
import grammarRaw from "../../db/seed/grammar.json";
import writingRaw from "../../db/seed/writing.json";
import listeningRaw from "../../db/seed/listening.json";

export interface BankItem {
  id: string;
  strand: string;
  level: number;
  subskill: string;
  format: string;
  status: string;
  culturalContextFlag: boolean;
  estimatedTimeSec: number;
  payload: Record<string, unknown>;
  /** Not tracked statically — kept for shape parity with the DB row. */
  nAttempts: number;
}

const ALL: BankItem[] = (
  [
    ...(readingRaw as unknown[]),
    ...(grammarRaw as unknown[]),
    ...(writingRaw as unknown[]),
    ...(listeningRaw as unknown[]),
  ] as Omit<BankItem, "nAttempts">[]
).map((it) => ({ ...it, nAttempts: 0 }));

const byId = new Map<string, BankItem>(ALL.map((i) => [i.id, i]));

/** Look up a single item by id. */
export function getItemById(id: string): BankItem | undefined {
  return byId.get(id);
}

/** All live items for a strand. */
export function getLiveItems(strand: string): BankItem[] {
  return ALL.filter((i) => i.strand === strand && i.status === "live");
}
