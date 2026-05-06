import type { Level, Stream } from "./types";

const ESL_COURSES: Record<number, string> = {
  1: "ESLAO",
  2: "ESLBO",
  3: "ESLCO",
  4: "ESLDO",
  5: "ESLEO",
  6: "Mainstream",
};

const ELD_COURSES: Record<number, string> = {
  1: "ELDAO",
  2: "ELDBO",
  3: "ELDCO",
  4: "ELDDO",
  5: "ELDEO",
  6: "Mainstream",
};

/**
 * Maps stream + lowest strand level to an Ontario course code.
 * Uses the lowest strand (not average) per DESIGN.md §6.2.
 */
export function mapToCourse(stream: Stream, lowestLevel: Level): string {
  const map = stream === "ESL" ? ESL_COURSES : ELD_COURSES;
  return map[lowestLevel] ?? "ESLAO";
}
