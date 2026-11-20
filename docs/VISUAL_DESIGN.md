# Visual Design

Shared visual conventions for the leaaf web app. They come from the design review of 2026-11-20 and the first implementation in `web/`. Feature-specific interactions live in the feature's `DESIGN.md`.

## Visual direction

Calm, light, and friendly: mostly white and off-white surfaces with one fresh green for actions and highlights. Rounded shapes, soft shadows, and short text. Nothing should be tiring to look at or require reading a wall of text. The brand mark is a leaf in a light-green rounded tile next to the lowercase wordmark "leaaf".

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

- **Type:** Inter (Google Fonts), weights 400–800. Wordmark and headings use heavy weights with tight tracking.
- **Shape:** Cards 20 px radius, buttons and toggles fully rounded (pill), icon tiles 14–18 px radius.
- **Layout:** Content width up to 1312 px, 64 px side padding. The result screen is a flexible left column and a 400 px right column with 28 px gap.

## Components and states

- **Primary button:** green pill, white text, soft green shadow; hover darkens; disabled lowers opacity.
- **Path card:** white card, 2 px green border when selected, status badge (Viable green, Conditional amber, Not suitable red), "Recommended" green pill on the first viable path, chevron for expand.
- **Loading:** grey shimmer blocks in the exact layout of the final screen; a spinner with a one-line status above them.
- **Errors:** white card with a title and one explanatory sentence; amber notes for incomplete data.

## Responsive behavior, accessibility, and motion

- Laptop screens only for now (1280 px and wider). No responsive layouts.
- Visible focus ring (3 px light green). Native `select` and `button` elements. Color is never the only carrier of meaning: statuses are also written out.
- Shimmer, spinner, and needle motion are switched off for `prefers-reduced-motion`.

## Proposed changes and open questions

- Dark mode: not planned.
- Mobile layout: deferred; feature 004 currently requires 360 px (see feature 006, planned replacements).
- Exact green and amber values will be reviewed with the team after the first look at the screens.

## References

- Tokens: [`web/src/index.css`](../web/src/index.css)
- Feature design: [`feature-006 DESIGN.md`](features/feature-006-web-app/DESIGN.md)
