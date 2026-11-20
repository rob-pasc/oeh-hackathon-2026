# Implementation Tasks: Web app (landing, scan session, results)

- **Feature ID:** `feature-006-web-app`
- **Status:** Implemented (verification pending)

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Set up `web/` (Vite, React, TypeScript, Tailwind via PostCSS, Vitest config), add it to the root workspaces, and document the commands (supports `AC-012`)
- [x] **T-002:** Write the pure logic: routes, gauge geometry, impact formatting, path views from `Assessment` and `Report`, scan summary (supports `AC-005`, `AC-006`, `AC-007`, `AC-010`)
- [x] **T-003:** Write the API layer: client interface, mock client on the shared fixtures, live client (supports `AC-002`, `AC-003`, `AC-012`)
- [x] **T-004:** Build the landing page with the Scan now flow (supports `AC-001`, `AC-002`)
- [x] **T-005:** Build the session page: skeleton, status line, completion and error states (supports `AC-003`, `AC-004`)
- [x] **T-006:** Build the result screen: path cards, gauge, specs card, toolbar, not-found states (supports `AC-005` to `AC-011`)
- [x] **T-007:** Add shared visual conventions in `docs/VISUAL_DESIGN.md`, update `README.md`, `web/README.md`, and the feature index (supports `AC-013`)
- [x] **T-008:** Install dependencies and run `npm run typecheck`, `npm test`, and `npm run build -w web`; fix what they report (supports all ACs)
- [ ] **T-009:** Review the screens in a browser at 1440 × 900 and 1280 × 720 with the team; record the findings (supports `AC-013`)
- [x] **T-010:** Agree the session routes and events with the backend team and switch on live mode (supports `AC-014`)

## Dependencies and blockers


## Progress notes

The first version was written without network access. After the merge into `main` (b879a96) the dependencies were installed; the web type-check fix is a846d99. T-008 is done: type check, tests, and build pass (see the verification notes in `ACCEPTANCE_CRITERIA.md`). The browser review (T-009) remains.

2026-11-20: T-010 done. The session routes, events, and executable trailer were decided with the user, then implemented in `shared/src/session.ts`, the server, and the scanner. The web client now takes the session types from `shared/`, routes `/s/` only for 26-character Crockford IDs, and proxies `/api` and `/downloads` in `npm run dev`. The browser journey against the real backend (AC-014) still needs a Windows run of the scanner.

## Lifecycle history

- 2026-11-20: Implemented in a first version on the branch `feat/web-ui`. Required verification (T-008, T-009) is pending, so the feature is not complete.
- 2026-11-20: Merged into `main` (b879a96). T-008 done; T-009 and T-010 still pending.
