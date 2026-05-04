import type { SkillResult } from "@/lib/types"

/** Derive the active pending skill names used to hydrate the client action bar. */
export function deriveInitialPendingSkills(skillResults: SkillResult[]) {
  return skillResults
    .filter(
      (item) =>
        item.superseded_by === null &&
        (item.skill_name === "relevance_scoring" ||
          item.skill_name === "summarization") &&
        (item.status === "pending" || item.status === "running"),
    )
    .map((item) => item.skill_name as "relevance_scoring" | "summarization")
}