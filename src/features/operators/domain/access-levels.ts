import type { OperatorCapability } from "@/db/schema/assignments";

/**
 * The three ways an operator is trusted with a match, in the order an admin
 * meets them. Every level can report a problem, because an operator who cannot
 * ask for help is worse than one who can.
 */
export const accessLevels = [
  {
    value: "SCORE_AND_CONFIRM",
    label: "Score and confirm results",
    description: "Enters scores and confirms the final result.",
    capabilities: [
      "VIEW",
      "SCORE_UPDATE",
      "FINALIZE_MATCH",
      "ISSUE_REPORT",
    ] as OperatorCapability[],
  },
  {
    value: "SCORE_ONLY",
    label: "Score only",
    description: "Enters scores, an admin confirms the result.",
    capabilities: [
      "VIEW",
      "SCORE_UPDATE",
      "ISSUE_REPORT",
    ] as OperatorCapability[],
  },
  {
    value: "WATCH",
    label: "Watch only",
    description: "Follows the matches and can report a problem.",
    capabilities: ["VIEW", "ISSUE_REPORT"] as OperatorCapability[],
  },
] as const;

export type AccessLevel = (typeof accessLevels)[number]["value"];

export const defaultAccessLevel: AccessLevel = "SCORE_AND_CONFIRM";

export function capabilitiesForLevel(level: AccessLevel): OperatorCapability[] {
  const match = accessLevels.find((item) => item.value === level);
  return [...(match ?? accessLevels[0]).capabilities];
}

const capabilityLabels: Record<OperatorCapability, string> = {
  VIEW: "View",
  SCORE_UPDATE: "Update scores",
  FINALIZE_MATCH: "Confirm results",
  ISSUE_REPORT: "Report problems",
};

/**
 * Names the level an assignment sits at. Assignments made before levels
 * existed can hold any combination, so those fall back to listing them.
 */
export function describeCapabilities(capabilities: OperatorCapability[]) {
  const held = new Set(capabilities);
  const level = accessLevels.find(
    (item) =>
      item.capabilities.length === held.size &&
      item.capabilities.every((capability) => held.has(capability)),
  );

  if (level) return level.label;

  return (
    capabilities
      .map((capability) => capabilityLabels[capability])
      .join(" · ") || "No access"
  );
}
