# web

React + TypeScript single-page app (Vite, Tailwind CSS v4). Specified in [feature 006](../docs/features/feature-006-web-app/PLAN.md).

| Route | Screen |
|---|---|
| `/` | Landing page with **Scan now** |
| `/s/:sessionId` | Scan session: result skeleton and live scanner status; becomes the result screen when the scan completes |
| `/d/:deviceId` | Result screen: ranked AI categories with a tab per category, option cards, CO₂e gauge, scan specs, and the Use and priority toolbar ([feature 008](../docs/features/feature-008-ai-categories-and-options/PLAN.md)) |

While the server searches the web for a laptop the knowledge base does not cover, the thinking line reads "Searching the web…" (report stream `status` event). The five assessed paths show first, while the server's category call runs. Then the Overview lists the categories, ranked locally with `rankCategories` (shared). Selecting a category opens its tab with one card per option. An option card shows cost, extra life, CO₂e avoided and score, and marks AI-estimated figures with "AI estimate" (also on the gauge). Opening it shows the "Why" text and up to two source links (a page found by web search is labelled "Web source" with its site and retrieval date, [feature 017](../docs/features/feature-017-web-evidence-for-model-facts/PLAN.md)), then the option's step plan ([feature 009](../docs/features/feature-009-concrete-step-plans/PLAN.md)): numbered steps with tools, parts, time, a Caution warning or "Professional only", and source links. The plan is requested the first time the option is opened and kept for the visit; a template plan carries the notice "AI steps unavailable". In mock mode every sample option has a plan. When the result carries a plan ([feature 013](../docs/features/feature-013-combined-plan-card/PLAN.md)), a "Your plan" card above the categories shows its steps in order with combined cost, extra life and CO₂e avoided (no score), and the gauge shows the plan on the Overview. Opening the card loads one step list for the whole plan ([feature 014](../docs/features/feature-014-plan-step-list/PLAN.md)), once per visit and use. Switching priority re-ranks categories and options without a request and explains which weight changes moved them. When the AI is unavailable, the five paths appear as five categories with the notice "AI explanation unavailable". The scan specs card shows, under each part row, the part lookup ([feature 018](../docs/features/feature-018-part-lookup/PLAN.md)): a Knowledge base, Web search · check or No match badge with a cited sentence and its source link, or "Looking up…" while `GET /api/devices/:id/parts` loads. Without lookups the card looks as before; in mock mode the sample laptop shows every badge.

## Run

From the repository root (Node 24 or later):

```sh
npm install
npm run dev -w web        # http://localhost:5173
npm test -w web           # Vitest + Testing Library
npm run typecheck -w web
npm run build -w web
```

## Mock and live mode

By default the app runs on the fictional fixtures in [`shared/fixtures/`](../shared/fixtures/) and simulates the scanner, so no backend is needed. The example laptop shows the sample categories (`categories.example-laptop-14.office.json`, with an AI-estimated and a Not a fit option, and a sample plan), plus a fictional web source on its memory option and the web search line first; the example desktop shows the five-path fallback. The landing page shows a "Sample data" label. To talk to the real API set `VITE_API_MODE=live` (see [`.env.example`](.env.example)) and run `npm start -w server`; the dev server forwards `/api` and `/downloads` to it (`VITE_API_PROXY`, default `http://127.0.0.1:3000`). The scan-session flow is described in the [design](../docs/features/feature-006-web-app/DESIGN.md).

## Container image

`web/Dockerfile` builds the app and serves it with nginx on port 8080 (`web/nginx.conf`). Build it from the repository root. The API mode is fixed at build time and defaults to `live`, which is what CI publishes:

```sh
docker build -f web/Dockerfile -t leaaf-web .
docker build -f web/Dockerfile --build-arg VITE_API_MODE=mock -t leaaf-web-mock .   # sample data, no backend
```

See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Layout

```text
src/app/          route switch and router
src/pages/        Landing, ScanSession, DevicePage, NotFound
src/components/   PathCard, Gauge, SpecsCard, Toolbar, ResultsView, skeletons
src/lib/          formatting, gauge geometry, path views, scan summary
src/api/          ApiClient interface, mock client, live client
src/test/         tests
```

`shared/` is imported through the aliases `@leaaf/shared/*` (sources) and `@leaaf/fixtures/*` (fixtures), configured in `vite.config.ts` and `tsconfig.json`, so no build step is needed there. Shared visual conventions: [docs/VISUAL_DESIGN.md](../docs/VISUAL_DESIGN.md).
