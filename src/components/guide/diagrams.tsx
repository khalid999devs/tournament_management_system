import styles from "./guide.module.css";

/**
 * A five-player knockout bracket, drawn the way the platform builds it:
 * seeds 1, 2 and 3 get a bye, so only seeds 4 and 5 play in round one.
 */
export function BracketDiagram() {
  // One grid: every round-one slot is the same height and pitch, so no pair
  // of boxes ends up closer together than another.
  const slot = 52;
  const top = 30;
  const y = (index: number) => top + index * slot;
  const byes = [1, 2, 3];

  return (
    <figure className={styles.figure}>
      <svg viewBox="0 0 620 262" role="img" aria-labelledby="bracket-desc">
        <title id="bracket-desc">
          Five players. Seeds 1, 2 and 3 sit out round one. Seeds 4 and 5 play
          each other, and the winner meets seed 1 in the semi-finals, while seed
          2 plays seed 3. Those two winners meet in the final.
        </title>

        <text className={styles.round} x="0" y="14">
          ROUND 1
        </text>
        <text className={styles.round} x="222" y="14">
          SEMI-FINALS
        </text>
        <text className={styles.round} x="444" y="14">
          FINAL
        </text>

        <rect className={styles.box} x="0" y={y(0)} width="170" height="40" />
        <text className={styles.label} x="12" y={y(0) + 17}>
          Seed 4
        </text>
        <text className={styles.label} x="12" y={y(0) + 32}>
          Seed 5
        </text>

        {byes.map((seed, index) => (
          <g key={seed}>
            <rect
              className={styles.boxGhost}
              x="0"
              y={y(index + 1)}
              width="170"
              height="40"
            />
            <text className={styles.muted} x="12" y={y(index + 1) + 24}>
              Seed {seed} sits out
            </text>
          </g>
        ))}

        {/* Round one into the semi-finals. */}
        <path className={styles.line} d="M170 50 H196 V76 H222" />
        <path className={styles.line} d="M170 102 H196 V76 H222" />
        <path className={styles.line} d="M170 154 H196 V180 H222" />
        <path className={styles.line} d="M170 206 H196 V180 H222" />

        <rect className={styles.box} x="222" y="56" width="170" height="40" />
        <text className={styles.label} x="234" y="73">
          Seed 1
        </text>
        <text className={styles.label} x="234" y="88">
          Winner of round 1
        </text>

        <rect className={styles.box} x="222" y="160" width="170" height="40" />
        <text className={styles.label} x="234" y="177">
          Seed 2
        </text>
        <text className={styles.label} x="234" y="192">
          Seed 3
        </text>

        <path className={styles.line} d="M392 76 H418 V128 H444" />
        <path className={styles.line} d="M392 180 H418 V128 H444" />

        <rect
          className={styles.boxSolid}
          x="444"
          y="108"
          width="170"
          height="40"
        />
        <text className={styles.labelLight} x="456" y="125">
          Winner of semi 1
        </text>
        <text className={styles.labelLight} x="456" y="140">
          Winner of semi 2
        </text>
      </svg>
      <figcaption>
        Five players, so three sit out round one. That free pass always goes to
        the best-ranked players, and never to two people who would have played
        each other.
      </figcaption>
    </figure>
  );
}

/** The life of one match, from the draw to the public results page. */
export function MatchFlowDiagram() {
  const steps = [
    { label: "Scheduled", note: "from the draw" },
    { label: "In progress", note: "operator starts" },
    { label: "Score", note: "tap by tap" },
    { label: "Confirmed", note: "by the operator" },
    { label: "Winner goes on", note: "automatically" },
  ];

  return (
    <figure className={styles.figure}>
      <svg viewBox="0 0 640 190" role="img" aria-labelledby="flow-desc">
        <title id="flow-desc">
          A match is created by the draw as scheduled, the operator starts it,
          enters the score, then confirms the result, and the winner advances
          automatically. An admin can reopen a confirmed result with a reason,
          and a no-show is recorded as a walkover instead of a score.
        </title>

        {steps.map((step, index) => {
          const x = index * 128;
          return (
            <g key={step.label}>
              <rect
                className={index === 4 ? styles.boxSolid : styles.box}
                x={x}
                y="20"
                width="112"
                height="46"
              />
              <text
                className={index === 4 ? styles.labelLight : styles.label}
                x={x + 10}
                y="42"
              >
                {step.label}
              </text>
              <text
                className={index === 4 ? styles.labelLight : styles.muted}
                x={x + 10}
                y="58"
              >
                {step.note}
              </text>
              {index < steps.length - 1 ? (
                <path
                  className={styles.lineStrong}
                  d={`M${x + 112} 43 H${x + 128}`}
                  markerEnd="url(#arrow)"
                />
              ) : null}
            </g>
          );
        })}

        <defs>
          <marker
            id="arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 z" fill="currentColor" />
          </marker>
        </defs>

        {/* Two ways out of the normal path. */}
        <path className={styles.line} d="M310 66 V112 H180 V132" />
        <rect className={styles.box} x="96" y="132" width="170" height="40" />
        <text className={styles.label} x="108" y="150">
          Walkover
        </text>
        <text className={styles.muted} x="108" y="165">
          nobody turned up
        </text>

        <path className={styles.line} d="M440 66 V112 H470 V132" />
        <rect className={styles.box} x="386" y="132" width="180" height="40" />
        <text className={styles.label} x="398" y="150">
          Reopened by an admin
        </text>
        <text className={styles.muted} x="398" y="165">
          with a reason
        </text>
      </svg>
      <figcaption>
        Everything an operator does is written to the match log with their name,
        so a disputed result always has an answer.
      </figcaption>
    </figure>
  );
}

/** Where scoring settings sit in the life of a game. */
export function ScoringFlowDiagram() {
  // Five steps across 620 units: each box is 112 wide, so the labels are kept
  // short enough to sit inside one at 12px.
  const steps = [
    { label: "Scoring type", note: "what they tap" },
    { label: "Its rules", note: "target, format" },
    { label: "The draw", note: "rules lock now" },
    { label: "Operators score", note: "on their phones" },
    { label: "Result", note: "worked out" },
  ];

  return (
    <figure className={styles.figure}>
      <svg viewBox="0 0 620 96" role="img" aria-labelledby="scoring-desc">
        <title id="scoring-desc">
          You pick a scoring type, set its rules, then make the draw. The rules
          lock once the first match starts. Operators then enter scores, and the
          platform works out the result.
        </title>
        {steps.map((step, index) => {
          const x = index * 128;
          const last = index === steps.length - 1;
          return (
            <g key={step.label}>
              <rect
                className={last ? styles.boxSolid : styles.box}
                x={x}
                y="20"
                width="112"
                height="52"
              />
              <text
                className={last ? styles.labelLight : styles.label}
                x={x + 10}
                y="44"
              >
                {step.label}
              </text>
              <text
                className={last ? styles.labelLight : styles.muted}
                x={x + 10}
                y="60"
              >
                {step.note}
              </text>
              {last ? null : (
                <path
                  className={styles.line}
                  d={`M${x + 112} 46 H${x + 128}`}
                />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        Set the rules before the draw. Once the first match starts they are
        fixed, so every result in that game is judged the same way.
      </figcaption>
    </figure>
  );
}

/** How wide each kind of access reaches, drawn as nested boxes. */
export function AccessDiagram() {
  const rows = [
    { label: "The whole tournament", note: "every game", x: 0, w: 560 },
    { label: "A whole game", note: "every match in it", x: 40, w: 480 },
    { label: "One round", note: "the matches in it", x: 80, w: 400 },
    { label: "One match", note: "just that one", x: 120, w: 320 },
  ];

  return (
    <figure className={styles.figure}>
      <svg viewBox="0 0 600 236" role="img" aria-labelledby="access-desc">
        <title id="access-desc">
          Access reaches from the whole tournament, through a whole game, a
          round, and a single match. Choosing players instead covers every match
          those players appear in, wherever they are in the tournament.
        </title>
        {rows.map((row, index) => (
          <g key={row.label}>
            <rect
              className={index === 1 ? styles.boxSolid : styles.box}
              x={row.x}
              y={index * 46 + 8}
              width={row.w}
              height="38"
            />
            <text
              className={index === 1 ? styles.labelLight : styles.label}
              x={row.x + 14}
              y={index * 46 + 26}
            >
              {row.label}
            </text>
            <text
              className={index === 1 ? styles.labelLight : styles.muted}
              x={row.x + 14}
              y={index * 46 + 40}
            >
              {row.note}
            </text>
          </g>
        ))}
        <rect
          className={styles.boxGhost}
          x="0"
          y="192"
          width="560"
          height="38"
        />
        <text className={styles.label} x="14" y="210">
          Players
        </text>
        <text className={styles.muted} x="14" y="224">
          every match those players are in, anywhere in the tournament
        </text>
      </svg>
      <figcaption>
        A whole game is the usual choice. It already covers every round and
        match inside it, including ones the draw has not created yet.
      </figcaption>
    </figure>
  );
}

/** The order an event is set up and run in. */
export function EventFlowDiagram() {
  const steps = [
    { label: "Set up", note: "dates, venue, games" },
    { label: "Open registration", note: "checklist must pass" },
    { label: "Check payments", note: "approve or reject" },
    { label: "Close and draw", note: "make the matches" },
    { label: "Play", note: "operators score" },
    { label: "Publish results", note: "when you are ready" },
  ];

  return (
    <figure className={styles.figure}>
      <svg viewBox="0 0 620 168" role="img" aria-labelledby="event-desc">
        <title id="event-desc">
          Set the event up, open registration once the checklist passes, check
          each payment, close registration and make the draw, play the matches,
          then publish the results.
        </title>
        {steps.map((step, index) => {
          const x = (index % 3) * 208;
          const y = index < 3 ? 14 : 106;
          const last = index === steps.length - 1;
          return (
            <g key={step.label}>
              <rect
                className={last ? styles.boxSolid : styles.box}
                x={x}
                y={y}
                width="188"
                height="48"
              />
              <text
                className={last ? styles.labelLight : styles.label}
                x={x + 12}
                y={y + 22}
              >
                {step.label}
              </text>
              <text
                className={last ? styles.labelLight : styles.muted}
                x={x + 12}
                y={y + 38}
              >
                {step.note}
              </text>
              {index === 2 || last ? null : (
                <path
                  className={styles.line}
                  d={`M${x + 188} 38 H${x + 208}`}
                />
              )}
            </g>
          );
        })}
        {/* Down the right, back along, and into the second row. */}
        <path className={styles.line} d="M610 62 V84 H10 V106" />
        <path className={styles.line} d="M188 130 H208" />
        <path className={styles.line} d="M396 130 H416" />
      </svg>
      <figcaption>
        Each step unlocks the next. The checklist on this page lists whatever is
        still missing before registration can open.
      </figcaption>
    </figure>
  );
}

/** What happens to a tap made while the phone has no signal. */
export function OfflineFlowDiagram() {
  return (
    <figure className={styles.figure}>
      <svg viewBox="0 0 600 112" role="img" aria-labelledby="offline-desc">
        <title id="offline-desc">
          A tap made with no signal is kept on the phone, waits in order, and
          sends itself when the connection returns. The screen then shows all
          saved.
        </title>
        {[
          { label: "You tap", note: "goal, point, board" },
          { label: "Kept on the phone", note: "even if it restarts" },
          { label: "Sent in order", note: "when signal returns" },
          { label: "Saved", note: "the top bar says so" },
        ].map((step, index) => {
          const x = index * 152;
          return (
            <g key={step.label}>
              <rect
                className={index === 3 ? styles.boxSolid : styles.box}
                x={x}
                y="24"
                width="134"
                height="48"
              />
              <text
                className={index === 3 ? styles.labelLight : styles.label}
                x={x + 12}
                y={index === 3 ? 48 : 46}
              >
                {step.label}
              </text>
              <text
                className={index === 3 ? styles.labelLight : styles.muted}
                x={x + 12}
                y={index === 3 ? 64 : 62}
              >
                {step.note}
              </text>
              {index < 3 ? (
                <path
                  className={styles.lineStrong}
                  d={`M${x + 134} 48 H${x + 152}`}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption>
        Nothing is lost when the wifi drops. The only way to cause trouble is to
        enter the same score again on a different phone.
      </figcaption>
    </figure>
  );
}
