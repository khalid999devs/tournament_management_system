import { OfflineFlowDiagram } from "@/components/guide/diagrams";
import { Guide } from "@/components/guide/guide";

/** Help for a volunteer scoring a match on their phone. */
export function OperatorScoringGuide() {
  return (
    <Guide label="How to score" title="Scoring this match">
      <h3>The three steps</h3>
      <ol>
        <li>
          <strong>Start match</strong> when play begins. Recording the first
          score starts it too, so you cannot forget.
        </li>
        <li>
          <strong>Enter the score</strong> as it happens. The buttons match the
          game you are running.
        </li>
        <li>
          <strong>Finalize result</strong> at the end, then confirm. After that,
          only an admin can change it, so read the score first.
        </li>
      </ol>

      <h3>If you lose signal</h3>
      <p>
        Keep scoring. Everything you tap is kept on this phone and sends itself
        when the signal comes back. The bar at the top tells you what is
        waiting.
      </p>
      <OfflineFlowDiagram />
      <p>
        <strong>Do not re-enter the same score on another phone.</strong> Wait
        for this one to catch up, or you will end up arguing with yourself.
      </p>

      <h3>If someone else is scoring the same match</h3>
      <p>
        You will see:{" "}
        <em>
          Someone else updated this match. Check the latest score and confirm
          again.
        </em>{" "}
        Nothing you entered was thrown away silently. Look at what is on screen
        now, then carry on.
      </p>

      <h3>If a player does not turn up</h3>
      <p>
        Open <strong>A competitor did not show up</strong>, tick who is missing,
        and record the walkover. The player who came wins. If nobody came,
        nobody goes through.
      </p>

      <h3>If something is wrong</h3>
      <p>
        Use <strong>Report a problem</strong>: a broken table, an argument about
        a score, anyone missing. The admins see it straight away and it does not
        change the score. You can undo your own last score entry from the match
        log.
      </p>
    </Guide>
  );
}
