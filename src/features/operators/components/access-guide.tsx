import { AccessDiagram } from "@/components/guide/diagrams";
import { Guide } from "@/components/guide/guide";

/** Plain-language help for giving an operator access. */
export function AccessGuide() {
  return (
    <Guide label="How access works" title="Giving an operator access">
      <h3>The short version</h3>
      <p>
        Tick the games an operator will score on the Operators list. That is all
        most events need. Everything below is for the cases where a whole game
        is too much.
      </p>

      <h3>What they can reach</h3>
      <p>
        An operator sees nothing until you give them something. You choose how
        wide that is, from the whole tournament down to a single player.
      </p>
      <AccessDiagram />
      <ul>
        <li>
          <strong>A whole game</strong> covers every match in it, including
          matches the draw creates later. This is the usual choice.
        </li>
        <li>
          <strong>The whole tournament</strong> covers every game. Give it to
          someone who runs the floor.
        </li>
        <li>
          <strong>One round</strong> or <strong>one match</strong> is for
          handing a single job to somebody.
        </li>
        <li>
          <strong>Players</strong> covers every match those players are in.
          Handy when one person follows a team or a group of entrants around.
        </li>
      </ul>

      <h3>What they can do</h3>
      <ul>
        <li>
          <strong>Score and confirm results.</strong> The normal one. They enter
          the score and confirm the final result themselves.
        </li>
        <li>
          <strong>Score only.</strong> They enter the score but an admin
          confirms it. Use it for a volunteer you are still training.
        </li>
        <li>
          <strong>Watch only.</strong> They can follow matches and report a
          problem, and change nothing.
        </li>
      </ul>
      <p>Everyone can report a problem, whatever level you choose.</p>

      <h3>Things that catch people out</h3>
      <ul>
        <li>
          Access adds up. If someone has the whole tournament, adding one game
          changes nothing, and the page says so.
        </li>
        <li>
          Giving the same thing twice does not stack. It replaces what was
          there.
        </li>
        <li>
          Taking access away applies the next time they load a page, not
          mid-tap.
        </li>
        <li>
          Deactivating an operator removes everything they had, and turning them
          back on does not bring it back. You give the games again.
        </li>
        <li>Operators never see anybody&apos;s payment details.</li>
      </ul>
    </Guide>
  );
}
