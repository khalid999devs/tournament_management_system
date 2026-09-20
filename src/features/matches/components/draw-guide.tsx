import { BracketDiagram, MatchFlowDiagram } from "@/components/guide/diagrams";
import { Guide } from "@/components/guide/guide";

/** Plain-language help for the draw panel. */
export function DrawGuide() {
  return (
    <Guide label="How the draw works" title="The draw and bracket">
      <h3>What the draw does</h3>
      <p>
        You press it once for a game. It creates the whole competition for that
        game in one go: every round, every match, and who plays who. You do not
        build matches by hand.
      </p>

      <h3>Sitting out the first round</h3>
      <p>
        Brackets work in doubles: 2, 4, 8, 16 players. If your number is not one
        of those, some players have nobody to play in round one and go straight
        through. That free pass is called a <strong>bye</strong>. It goes to the
        best-ranked players, and never to two people who would have played each
        other.
      </p>
      <BracketDiagram />

      <h3>The two ways to draw</h3>
      <ul>
        <li>
          <strong>Random draw.</strong> The computer shuffles everyone. Nobody
          can guess the result or arrange it, so it is the fair choice when the
          draw is made in front of people.
        </li>
        <li>
          <strong>Manual draw.</strong> You put the players in order, best
          first. The top two go to opposite ends of the bracket, so they cannot
          meet until the final. Use it when the committee has agreed who the
          strongest players are.
        </li>
      </ul>

      <h3>What happens next</h3>
      <MatchFlowDiagram />
      <ul>
        <li>
          Winners move on by themselves. As soon as an operator confirms a
          result, that player shows up in their next match.
        </li>
        <li>
          Matches get a short name like <strong>TT-R1-01</strong>, and the last
          one is <strong>TT-F</strong> for the final, so people can call out a
          match by name.
        </li>
        <li>
          The bracket appears on the public Schedule, and on Results once you
          publish results.
        </li>
      </ul>

      <h3>Changing your mind</h3>
      <p>
        You can delete the draw and start again, but only before anyone has
        started playing, and not while operators are assigned to its matches.
        Once play begins, a wrong result is fixed by reopening that one match
        with a reason.
      </p>

      <h3>Games with three or more players at once</h3>
      <p>
        A bracket is one against one. For 29 Cards, a Free Fire lobby or
        anything played in groups, set <strong>Progression</strong> to manual in
        the scoring rules. You then make each round yourself and tick who is in
        each match.
      </p>
    </Guide>
  );
}
