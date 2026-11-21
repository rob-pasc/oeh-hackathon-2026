# web

React + TypeScript single-page app (Vite, Tailwind CSS v4). Specified in [feature 006](../docs/features/feature-006-web-app/PLAN.md).

| Route | Screen |
|---|---|
| `/` | Landing page with **Scan now** |
| `/s/:sessionId` | Scan session: result skeleton and live scanner status; becomes the result screen when the scan completes |
| `/d/:deviceId` | Result screen: ranked AI categories with a tab per category, option cards, CO₂e gauge, scan specs, and the Use and priority toolbar ([feature 008](../docs/features/feature-008-ai-categories-and-options/PLAN.md)) |

The five assessed paths show first, while the server's category call runs. Then the Overview lists the categories, ranked locally with `rankCategories` (shared). Selecting a category opens its tab with one card per option. An option card shows cost, extra life, CO₂e avoided and score, and marks AI-estimated figures with "AI estimate" (also on the gauge). Opening it shows the "Why" text and up to two source links, then the option's step plan ([feature 009](../docs/features/feature-009-concrete-step-plans/PLAN.md)): numbered steps with tools, parts, time, a Caution warning or "Professional only", and source links. The plan is requested the first time the option is opened and kept for the visit; a template plan carries the notice "AI steps unavailable". In mock mode every sample option has a plan. The recommendation summary shows the best option of the Recommended category. Switching priority re-ranks categories and options without a request and explains which weight changes moved them. When the AI is unavailable, the five paths appear as five categories with the notice "AI explanation unavailable".

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

By default the app runs on the fictional fixtures in [`shared/fixtures/`](../shared/fixtures/) and simulates the scanner, so no backend is needed. The example laptop shows the sample categories (`categories.example-laptop-14.office.json`, with an AI-estimated and a Not a fit option); the example desktop shows the five-path fallback. The landing page shows a "Sample data" label. To talk to the real API set `VITE_API_MODE=live` (see [`.env.example`](.env.example)) and run `npm start -w server`; the dev server forwards `/api` and `/downloads` to it (`VITE_API_PROXY`, default `http://127.0.0.1:3000`). The scan-session flow is described in the [design](../docs/features/feature-006-web-app/DESIGN.md).

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
