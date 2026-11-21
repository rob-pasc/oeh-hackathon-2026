# ADR-007: The server caps AI part options at the feature 003 gates

- **Status:** Accepted
- **Date adopted:** 2026-11-21
- **Related feature(s):** [feature 011](../features/feature-011-tab-gauge-and-capped-option-status/PLAN.md); changes [feature 008](../features/feature-008-ai-categories-and-options/PLAN.md) FR-012
- **Supersedes:** [ADR-003](adr-003-ai-chosen-options.md) in part: its decision "The server does not re-check options against the feature 003 gates", for options of kind `ssd`, `ram` and `battery`

## Context

Under ADR-003 the AI decides each option's status, and the prompt tells it to use the assessed path statuses as a "starting point". On 2026-11-21 the team scanned a 2015 mini PC (4 GB DDR3, i3-5005U, no recognized graphics) and chose gaming. The upgrade gate said "Depends", but the AI rated "upgrade the SSD" a Good fit, so it became the Recommended option. Because a recommendation that contradicts the rules undermines trust in the demo, the user accepted a server-side cap for the part options (feature 011).

## Decision

- For options of kind `ssd` and `ram`, the server sets the status to the worse of the AI's status and the `upgrade` gate's status. For kind `battery`, it does the same with the `repair` gate (`capDraft` in `server/src/categories/options.ts`).
- When the cap lowers a status, the option's reason becomes the gate's first limiting reason, so text and status agree. A `not_suitable` result has no figures and no score, as before.
- The cap never raises a status. Options of kind `hand_down`, `salvage`, `recycle` and `other` keep the AI's status as under ADR-003.
- The cap runs when options are finished, so it also applies to cached AI answers without a new call.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| Only tighten the prompt | No code change | Statuses would still rest on the AI alone; the same contradiction could recur |
| Cap every priced kind, including `hand_down`, `salvage` and `recycle` | One rule for all | Not agreed; those gates describe the device's end of use, not the part work, and the AI often has device-specific reasons there |
| Split the upgrade gate per part (SSD and RAM separately) | No over-capping: an SSD option is not lowered by a RAM-only finding | More change to feature 003; possible later |

## Consequences

- An SSD, RAM or battery option can no longer be Good fit, and so not Recommended, when its gate says otherwise.
- The upgrade gate covers SSD and RAM together, so an SSD option can be lowered by a RAM-only finding (for example "cannot verify whether the RAM can be upgraded"). This errs toward caution.
- More results may show "no option is clearly recommended", which is the honest outcome.
- The safety of options outside the three part kinds still rests on the prompt (ADR-003).

## Implementation / validation references

- Code: `capDraft` and `finishOption` in `server/src/categories/options.ts`; `atMost` in `server/src/assessment/gates.ts`
- Tests: `server/test/categories.test.ts` "statuses capped by the gates (feature 011 AC-005 to AC-009)"
- Evidence: [feature 011 acceptance criteria](../features/feature-011-tab-gauge-and-capped-option-status/ACCEPTANCE_CRITERIA.md)

## Supersession notes (if applicable)

None.
