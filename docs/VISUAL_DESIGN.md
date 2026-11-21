# Visual Design

Shared visual conventions for the leaaf web app. They come from the design review of 2026-11-20 and the first implementation in `web/`. Feature-specific interactions live in the feature's `DESIGN.md`.

## Visual direction

Calm, light, and friendly: mostly white and off-white surfaces with one fresh green for actions and highlights. Rounded shapes, soft shadows, and short text. Nothing should be tiring to look at or require reading a wall of text. The leaaf.green wordmark is large on the landing page and smaller in the page header.

## Foundations

**Adopted.** The authoritative values are the design tokens in [`web/src/index.css`](../web/src/index.css) (`@theme`); the table lists their roles.

| Role | Token | Value |
|---|---|---|
| Page background | `page` | `#F8FAF8` |
| Cards | white | `#FFFFFF` with `shadow-card` |
| Primary action, highlights | `leaf` (hover `leaf-dark`) | `#2F7D4F` (`#256640`) |
| Light green tint (icon tiles, Viable badge) | `leaf-tint` | `#E6F2EA` |
| Text | `ink` | `#1F2933` |
| Secondary text | `muted` | `#5F6B76` |
| Conditional / warning | `amber-tint`, `amber-ink` | used sparingly |
| Not suitable / error | `rose-tint`, `rose-ink` | used sparingly |

- **Type:** Inter (Google Fonts), weights 400–800. Wordmark and headings use heavy weights with tight tracking. The logo is the wordmark "leaaf" followed by a smaller green ".green", without icon or animation. On the landing page a line of small letter-spaced capitals under it spells out "Lifecycle Evaluation and Action Finder" with the initials in green.
- **Selection:** selected text uses a `leaf-soft` background with `leaf-deep` text (contrast 5.4:1).
- **Shape:** Cards 20 px radius, buttons and toggles fully rounded (pill), icon tiles 14–18 px radius.
- **Layout:** Content width up to 1312 px, 64 px side padding. The result screen is a flexible left column and a 400 px right column with 28 px gap.

## Components and states

- **Primary button:** green pill, white text, soft green shadow; hover darkens; disabled lowers opacity.
- **Path card:** white card, 2 px green border when selected, status badge (Good fit green, Depends amber, Not a fit red), "Recommended" green pill on the first viable path, chevron for expand.
- **Tags:** white pill group with soft shadow; the active tag has a light-green fill with dark-green text (path tags) or a solid green fill with white text (priority toggle).
- **Toolbar:** a two-column grid like the result screen: Use dropdown and path tags in the left column (the tag bar fills the rest of the column), the priority toggle in the right column. The Use dropdown is a pill with its own chevron, not the browser's default arrow.
- **Path summary block:** a flat light-green block without shadow or chevron that heads a path tab. It is not clickable and must not look like a card; the white icon tile sits on the tint.
- **Option card:** a path card without rank, with the figures Cost, Extra life, and CO₂e added; opens to the steps like a path card.
- **Step block:** same white card as a path card, with the step number in a light-green tile and one line of text.
- **Loading:** grey shimmer blocks in the exact layout of the final screen; a spinner with a one-line status above them.
- **Errors:** white card with a title and one explanatory sentence; amber notes for incomplete data.

## Responsive behavior, accessibility, and motion

- Report pages retain two columns from 1280 px. On narrower screens the gauge and specs follow the cards. The compact toolbar allows horizontal scrolling within the path tags.
- Visible focus ring (3 px light green). Native `select` and `button` elements. Color is never the only carrier of meaning: statuses are also written out.
- Shimmer, spinner, and needle motion are switched off for `prefers-reduced-motion`.

## Proposed changes and open questions

- Dark mode: not planned.
- The report journey is verified at 360 px. The wider feature 006 team review is tracked separately.
- Exact green and amber values will be reviewed with the team after the first look at the screens.

## References

- Tokens: [`web/src/index.css`](../web/src/index.css)
- Feature design: [`feature-006 DESIGN.md`](features/feature-006-web-app/DESIGN.md)

## Motion

Motion explains a change, it is never decoration on its own: ranked cards slide to their new places, numbers count to their values, the active tag highlight slides, and new content fades in and rises a few pixels (about 0.3–0.7 s, ease-out). Cards lift 2 px on hover. The scan's laptop view pulses the zone being read. Everything stops when the system asks for reduced motion.
