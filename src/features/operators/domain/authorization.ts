import type { OperatorCapability } from "@/db/schema/assignments";

export type MatchScope = {
  tournamentId: string;
  tournamentGameId: string;
  roundId: string;
  matchId: string;
  participantEntryIds: string[];
};

export type EffectiveAssignment = {
  active: boolean;
  tournamentId: string;
  scopeType:
    "ALL_TOURNAMENT" | "GAME" | "ROUND" | "MATCH" | "PARTICIPANT_ENTRY";
  targetId: string | null;
  capabilities: OperatorCapability[];
};

export function canOperatorAccessMatch(
  activeOperator: boolean,
  assignments: EffectiveAssignment[],
  match: MatchScope,
  capability: OperatorCapability,
) {
  if (!activeOperator) return false;

  return assignments.some((assignment) => {
    if (
      !assignment.active ||
      assignment.tournamentId !== match.tournamentId ||
      !assignment.capabilities.includes(capability)
    ) {
      return false;
    }

    switch (assignment.scopeType) {
      case "ALL_TOURNAMENT":
        return true;
      case "GAME":
        return assignment.targetId === match.tournamentGameId;
      case "ROUND":
        return assignment.targetId === match.roundId;
      case "MATCH":
        return assignment.targetId === match.matchId;
      case "PARTICIPANT_ENTRY":
        return (
          assignment.targetId !== null &&
          match.participantEntryIds.includes(assignment.targetId)
        );
    }
  });
}
