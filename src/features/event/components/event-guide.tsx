import { EventFlowDiagram } from "@/components/guide/diagrams";
import { Guide } from "@/components/guide/guide";

/** Help for setting an event up and opening it. */
export function EventGuide() {
  return (
    <Guide label="How to set up" title="Setting the event up">
      <h3>The order to do things in</h3>
      <EventFlowDiagram />

      <h3>Nothing is public until you open it</h3>
      <p>
        While the event is a draft, only staff can see any of this. Students see
        the home page saying registration is not open yet.
      </p>

      <h3>Why the checklist blocks you</h3>
      <p>
        Registration cannot open until the event has dates, a venue, a closing
        time in the future, at least one open game, and a payment number for any
        game that costs money. That is deliberate: without them the site would
        take money for an event it cannot describe, and the confirmation email
        would carry a wrong date.
      </p>

      <h3>Payment numbers</h3>
      <p>
        Each registration keeps a copy of the number it was shown, so editing a
        number later never changes past records. There is no delete: turn a
        method off instead and it disappears from the form while its history
        stays.
      </p>
      <p>
        <strong>
          Send a small amount to each number yourself before you open
          registration.
        </strong>{" "}
        A wrong digit means students pay a stranger.
      </p>

      <h3>Closing and running</h3>
      <ul>
        <li>
          <strong>Close registration</strong> when the deadline passes. Pending
          payments can still be decided.
        </li>
        <li>
          <strong>Start the event</strong> when play begins.
        </li>
        <li>
          <strong>Publish results</strong> is a separate switch, so you can hold
          results back until the committee is ready.
        </li>
        <li>
          <strong>Archive</strong> is a one-way door. Do it when the event is
          over and you want to start the next one.
        </li>
      </ul>
    </Guide>
  );
}
