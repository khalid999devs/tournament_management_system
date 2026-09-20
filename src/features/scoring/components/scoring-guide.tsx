import { ScoringFlowDiagram } from "@/components/guide/diagrams";
import { Guide } from "@/components/guide/guide";
import styles from "@/components/guide/guide.module.css";

/**
 * What each scoring type means, and what the operator's phone actually shows,
 * so an admin can pick one without guessing.
 */
export function ScoringGuide() {
  return (
    <Guide label="How scoring works" title="Scoring rules">
      <p>
        The scoring type decides three things: how many players a match holds,
        what the operator taps on their phone, and how the winner is worked out.
        Pick the one that matches how the game is really played, then set its
        details below.
      </p>
      <p>
        These settings{" "}
        <strong>lock once the first match in the game starts</strong>, so every
        result in a game is judged by the same rules. Change them before you
        make the draw.
      </p>

      <ScoringFlowDiagram />

      <h3>Win, draw or loss</h3>
      <p>
        Chess, Ludo one against one, most board games. Two players. The operator
        records the outcome and nothing else.
      </p>
      <div className={styles.demo}>
        <span className={styles.key}>Ayesha won</span>
        <span className={styles.key}>Draw</span>
        <span className={styles.key}>Rafi won</span>
      </div>
      <p>
        In a knockout, a draw still needs a winner, so the operator is asked who
        won the tie-break. In a manually progressed game you can allow a draw to
        stand.
      </p>

      <h3>Goals</h3>
      <p>
        eFootball, FIFA, foosball, hockey. Two players. One tap per goal, with
        optional extra time and penalties.
      </p>
      <div className={styles.demo}>
        <span className={styles.readout}>2 &ndash; 1</span>
        <span className={styles.key}>Goal &middot; Ayesha</span>
        <span className={styles.key}>Goal &middot; Rafi</span>
      </div>

      <h3>Best-of sets</h3>
      <p>
        Table tennis, badminton, volleyball, squash. Two players. One tap per
        point. Sets close themselves, deuce included, and the match ends when
        someone has won enough sets.
      </p>
      <div className={styles.demo}>
        <span className={styles.readout}>
          11 &ndash; 7, 9 &ndash; 11, 11 &ndash; 5
        </span>
        <span className={styles.key}>Point &middot; Ayesha</span>
        <span className={styles.key}>Point &middot; Rafi</span>
      </div>

      <h3>Boards and points</h3>
      <p>
        Carrom, darts legs, pool frames. Two players. After each board the
        operator picks who won it and how many points it was worth. First to the
        target, or the leader once the board limit is reached, wins.
      </p>
      <div className={styles.demo}>
        <span className={styles.readout}>25 &ndash; 18 (7 boards)</span>
        <span className={styles.key}>Board won by Ayesha, +5</span>
      </div>

      <h3>Multi-player points</h3>
      <p>
        29 Cards, Ludo with four, Uno, quiz rounds.{" "}
        <strong>Two to sixteen players.</strong> The operator types each
        player&apos;s points for the hand and records it; placings come from the
        totals.
      </p>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>Player</th>
            <th>Total</th>
            <th>This hand</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ayesha</td>
            <td>34</td>
            <td>+5</td>
          </tr>
          <tr>
            <td>Rafi</td>
            <td>28</td>
            <td>&minus;2</td>
          </tr>
        </tbody>
      </table>

      <h3>Placement points</h3>
      <p>
        PUBG Mobile, Free Fire, racing, any battle royale lobby.{" "}
        <strong>Two to a hundred players.</strong> Each finishing position earns
        points from a table you set, plus optional points per elimination.
      </p>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>Player</th>
            <th>Finish</th>
            <th>Elims</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ayesha</td>
            <td>#1</td>
            <td>4</td>
            <td>18</td>
          </tr>
          <tr>
            <td>Rafi</td>
            <td>#2</td>
            <td>2</td>
            <td>11</td>
          </tr>
        </tbody>
      </table>

      <h3>Highest or lowest score wins</h3>
      <p>
        Scrabble, cube times, typing speed, quiz totals.{" "}
        <strong>Two to sixty-four players.</strong> One number each at the end.
        You say whether the biggest or the smallest number wins, which is what
        makes it work for both points and times.
      </p>
      <div className={styles.demo}>
        <span className={styles.readout}>42.00 &ndash; 39.50 seconds</span>
      </div>

      <h3>Progression: knockout or manual</h3>
      <ul>
        <li>
          <strong>Knockout</strong> makes the whole bracket from one draw and
          moves winners on by itself. Losing once puts you out. It is one
          against one, so it only suits the two-player types.
        </li>
        <li>
          <strong>Manual</strong> is for everything else, and for any format
          where you decide who plays next: you make each round and pick who is
          in each match. Use it for group games and leagues.
        </li>
      </ul>

      <h3>Ties</h3>
      <p>
        In the two types where players can finish level on totals, the operator
        gets a tie-break list and drags the tied players into order. A match
        cannot be confirmed while a tie is unresolved, so a shared placing never
        reaches the results page by accident.
      </p>
    </Guide>
  );
}
