import type { Level } from "./types";

const ESL_COURSES: Record<number, string> = {
  1: "ESLAO",
  2: "ESLBO",
  3: "ESLCO",
  4: "ESLDO",
  5: "ESLEO",
  6: "Mainstream",
};

/**
 * Maps the lowest strand level to an Ontario ESL course code.
 * Uses the lowest strand (not average) per DESIGN.md §6.2.
 * All students are routed through ESL — ELD routing is disabled.
 */
export function mapToCourse(_stream: string, lowestLevel: Level): string {
  return ESL_COURSES[lowestLevel] ?? "ESLAO";
}
