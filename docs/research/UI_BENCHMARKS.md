# UI Benchmark Research

Research performed 19 September 2026. The goal is to borrow proven interaction patterns without copying brand treatment or expanding the approved scope.

## Products reviewed

### Challonge

Useful pattern: direct bracket and match operations with clear tournament-state visibility. Its feature model reinforces keeping seeding, match times, participant management, and result progression tightly connected.

Source: [Challonge tournament features](https://web.challonge.com/features/tournaments)

Adopt:

- Fast access from a match list to result entry.
- Visible, compact match state.
- Simple progression language.

Avoid:

- Making brackets dominate the participant registration experience.

### Toornament

Useful pattern: structured stages, registration requests, scheduled match status, and organizer-focused competition operations.

Source: [Toornament organizer platform](https://organizer.toornament.com/)

Adopt:

- Clear separation between public publishing and organizer controls.
- Game/round/status filtering around operational lists.
- Explicit stage and progression context.

Avoid:

- Exposing configuration density to Score Operators.

### start.gg

Useful pattern: one event can contain multiple games and brackets with linked registration and progression.

Source: [start.gg](https://www.start.gg/)

Adopt:

- Event-level identity with game-level competition surfaces.
- Strong relationship between registration entries and bracket participation.

Avoid:

- Deep navigation, participant accounts, and community/profile features that would make the one-time NDCAK flow heavier.

### Multi-step form guidance

Long forms benefit from progressive steps, persistent labels, visible progress, clear review, and a final confirmation state.

Source: [UX4G User Experience Handbook](https://www.ux4g.gov.in/assets/img/pdf/UX4G-Handbook.pdf)

Adopt:

- Information, review, and payment as separate focused steps.
- One obvious primary action and one back/edit action.
- Persistent labels, concise field help, inline errors, and mobile-first spacing.

## NDCAK UI direction

- Public pages: warm institutional sports-event editorial design, strong typography, restrained composition, and one primary CTA.
- Registration: light surfaces, progressive disclosure, visible game fees/capacity, sticky mobile total when useful, and no unrelated marketing content.
- Admin: information-dense but quiet; server-side filters in URL; focused pending queue; status chips pair text with color.
- Operator: mobile/tablet-first match cards, large score controls, current version/status visible, and minimal secondary data.
- Branding: supplied logo, deep navy, warm gold, association green, warm ivory, Inter, and Barlow Condensed.

## Accessibility guardrails

- 44px minimum important touch targets.
- Persistent labels and visible keyboard focus.
- Status never communicated by color alone.
- Reduced-motion support.
- Tables use semantic headers and responsive fallbacks.
- Destructive and finalizing actions require explicit confirmation language.
