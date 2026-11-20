# web

React + TypeScript single-page app (Vite, Tailwind CSS v4). Specified in [feature 006](../docs/features/feature-006-web-app/PLAN.md).

| Route | Screen |
|---|---|
| `/` | Landing page with **Scan now** |
| `/s/:sessionId` | Scan session: result skeleton and live scanner status; becomes the result screen when the scan completes |
| `/d/:deviceId` | Result screen: five ranked path cards, CO₂e gauge, scan specs, Use and priority toolbar |

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

By default the app runs on the fictional fixtures in [`shared/fixtures/`](../shared/fixtures/) and simulates the scanner, so no backend is needed. The landing page shows a "Sample data" label. To talk to the real API set `VITE_API_MODE=live` (see [`.env.example`](.env.example)); the session routes it uses are proposed in the [design](../docs/features/feature-006-web-app/DESIGN.md) and still to be agreed with the backend team.

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
