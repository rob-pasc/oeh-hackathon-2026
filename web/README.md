# web

React + TypeScript single-page app (Vite, Tailwind CSS v4). Specified in [feature 006](../docs/features/feature-006-web-app/PLAN.md).

| Route | Screen |
|---|---|
| `/` | Landing page with **Scan now** |
| `/s/:sessionId` | Scan session: result skeleton and live scanner status; becomes the result screen when the scan completes |
| `/d/:deviceId` | Result screen: five ranked path cards, CO₂e gauge, scan specs, Use and priority toolbar, and expandable report evidence |

The recommendation summary uses calculator ranges. Open a path and its evidence disclosure for excerpts and source links. Switching priority reorders the paths locally and explains which weight changes affected the order.

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

By default the app runs on the fictional fixtures in [`shared/fixtures/`](../shared/fixtures/) and simulates the scanner, so no backend is needed. The landing page shows a "Sample data" label. To talk to the real API set `VITE_API_MODE=live` (see [`.env.example`](.env.example)) and run `npm start -w server`; the dev server forwards `/api` and `/downloads` to it (`VITE_API_PROXY`, default `http://127.0.0.1:3000`). The scan-session flow is described in the [design](../docs/features/feature-006-web-app/DESIGN.md).

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
