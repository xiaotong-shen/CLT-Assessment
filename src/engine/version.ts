/** Bump this whenever the MSAT algorithm logic changes. */
export const ENGINE_ALGORITHM_VERSION = "msat-1.0.0";

/**
 * Combined version string stamped on every recommendation.
 * In production the git SHA is injected at build time via NEXT_PUBLIC_GIT_SHA.
 */
export function getEngineVersion(): string {
  const sha = process.env["NEXT_PUBLIC_GIT_SHA"] ?? "local";
  return `${ENGINE_ALGORITHM_VERSION}+${sha}`;
}
