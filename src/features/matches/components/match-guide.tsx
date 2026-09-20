import { MatchFlowDiagram } from "@/components/guide/diagrams";
import { Guide } from "@/components/guide/guide";

/** Help for an admin looking at one match. */
export function MatchGuide() {
  return (
    <Guide label="How to fix a result" title="Running and fixing a match">
      <h3>Who does what</h3>
      <p>
        Operators enter the score on their phones. You only need this page when
        something has gone wrong, or when a time or table has to change.
      </p>
      <MatchFlowDiagram />

      <h3>The score is wrong</h3>
      <p>
        Use <strong>Reopen result</strong>. The match goes back to being played,
        so the score can be corrected and confirmed again. You have to give a
        reason, and it is kept in the log with your name.
      </p>
      <p>
        If the winner has already moved into the next match, reopening takes
        them back out. That only works while the next match has not started. If
        it has, reopen that one first, then come back.
      </p>

      <h3>Play has stopped</h3>
      <ul>
        <li>
          <strong>Postpone</strong> stops scoring and keeps the score and the
          players. <strong>Resume</strong> puts it back in play.
        </li>
        <li>
          <strong>Cancel</strong> exists only for games you progress by hand.
          The history is kept.
        </li>
      </ul>

      <h3>Somebody did not turn up</h3>
      <p>
        The operator records a walkover from their own screen: they tick who is
        absent and the player who came wins. You do not need to do anything
        here.
      </p>

      <h3>Time and place</h3>
      <p>
        Changing the start time, table or venue never touches the score. It
        updates the public schedule and the operator&apos;s list.
      </p>

      <h3>The log</h3>
      <p>
        Every action is listed in order with who did it and when. Where a
        phone&apos;s clock differed from the server, both times are shown. This
        is what settles an argument about a result.
      </p>
    </Guide>
  );
}
