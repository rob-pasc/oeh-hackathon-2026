# Feature 013: Admin scan overview

- **Feature ID:** `feature-013-admin-scan-overview`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

The team has no way to see which scans reach the public server except by reading the SQLite file on the host. This feature adds a password-protected admin page at `/admin`: one login, configured in the server's `.env`, and a read-only list of all stored scans with their time, device ID (linking to the result page), maker and model, system, and scan status.

Because the site is public and a device ID is the only key to a scan's result page, the list is a sensitive surface. The feature therefore defines the login, session and rate-limit protections as requirements, and keeps the admin area off unless it is configured.

## Problem and desired outcome

- **Problem:** Scans can only be inspected by opening the production database as root (`sqlite3` on the host). The team cannot quickly see how many scans arrived, when, or from which devices.
- **Desired outcome:** A team member opens `https://leaaf.green/admin`, logs in with the configured username and password, and sees the stored scans newest first, with a link to each result.
- **Target users / stakeholders:** The hackathon team operating the public demo. Visitors are unaffected: they get no cookie and no new data is collected about them.

## Approved scope

### In scope

- A login page at `/admin` in the site's visual style, and a **Log out** button.
- One admin account: `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the server's environment (`.env`).
- A read-only, paged list of stored scans: time, device ID linking to `/d/<id>`, maker and model, system, scan status, and the total count.
- Session handling, login rate limits, and the other protections listed under the requirements.
- Documentation: the `.env` templates, the deployment guide, the server README, the privacy notice's cookie section (DE/EN), and notes on the features whose rules change.

### Out of scope

- Storing or showing IP addresses (user choice 2026-11-21: "No IP").
- Deleting, editing or exporting scans; charts or statistics beyond the total count.
- More than one admin, roles, self-service password change, two-factor login.
- Hashed passwords in `.env` (user choice: plain password; see risks).
- Showing anything other than the listed fields of a scan on the admin page (the full scan stays on the result page). *(Replaced 2026-11-21 by FR-013 to FR-017: the Details view shows the full scan JSON and the AI status. The rest of this page stays read-only.)*
- Server logs on the admin page; IP addresses (still excluded after the 2026-11-21 revision).

## Functional requirements

- **FR-001:** When both `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set, `/admin` shows a login form with username and password fields. When either is missing or empty, every `/api/admin/*` route answers 404 and `/admin` says the admin area is not set up.
- **FR-002:** The server refuses to enable the admin area, and logs a startup warning without the password, when `ADMIN_PASSWORD` is shorter than 16 characters. The rest of the server starts normally.
- **FR-003:** A login with the configured username and password starts an admin session and shows the scan list. A wrong username or password is refused with one generic message ("Wrong username or password") that does not reveal which part was wrong. The comparison takes the same time whatever the input.
- **FR-004:** After 5 failed logins from one client within 15 minutes, further login attempts from that client are refused with 429 and a `Retry-After` until the window ends. After 50 failed logins from all clients together within 15 minutes, every login attempt is refused with 429 until that window ends. Successful logins do not count.
- **FR-005:** The session is a random token of at least 256 bits, kept in server memory and sent as a cookie that is `HttpOnly`, `Secure`, `SameSite=Strict`, and limited to the path `/api/admin`. It ends 12 hours after login, when **Log out** is pressed, or when the server restarts.
- **FR-006:** Without a valid session, every admin data route answers 401 and returns no scan data; the page then shows the login form.
- **FR-007:** The scan list shows the stored scans newest first, 50 per page, with previous and next page controls and the total number of scans. Each row shows the upload time (in the viewer's local time), the device ID as a link to `/d/<id>`, maker, model (the product name when the scan has one, else the model code), system (Windows, macOS or Linux; empty for scans without `os.family`), and complete or partial. Unreadable values show as a dash.
- **FR-008:** The admin page and its routes change nothing: no route deletes or edits a scan.
- **FR-009:** Admin responses carry `Cache-Control: no-store`, and the `/admin` page carries `noindex` so search engines do not list it. Request logs keep their current form (method and route pattern only), so usernames, passwords, session tokens and device IDs from admin requests are never logged.
- **FR-010:** Admin routes that change state (login, logout) accept only `application/json` bodies, so a form on another site cannot submit them.
- **FR-011:** Apart from the authenticated admin list, the public API still offers no route that lists or enumerates devices (feature-001-device-scan-and-upload / FR-011 for everyone else).
- **FR-012:** Visitors who do not open `/admin` receive no cookie. The privacy notice (German and English) says that only the admin login sets a strictly necessary session cookie, for the team, and that visitors receive none.

- **FR-013** *(added 2026-11-21)*: Each row of the scan list has a **Details** control. It shows the complete stored scan as formatted JSON with a **Copy JSON** button. The details are fetched only when opened, from an admin route that answers 401 without a session and 404 for an unknown or malformed device ID.
- **FR-014** *(added 2026-11-21)*: The details show the AI status of the scan for each intended use it was viewed with: whether the result categories came from the AI and when they were generated, and how many step plans came from the AI.
- **FR-015** *(added 2026-11-21)*: The details list the recorded AI fallbacks of the scan, newest first: time, which call (categories or steps), intended use, option for step plans, and the reason.
- **FR-016** *(added 2026-11-21)*: The server records each fallback of the category call and of the step call to a template: time, device ID, intended use, call, option ID for steps, and a reason from a fixed list (no AI configured, the provider's error kinds such as timeout or rate limit, or an answer the server rejected). It stores no prompt, answer, or message text. A step template shown because the categories already fell back is not recorded again.
- **FR-017** *(added 2026-11-21)*: The scan list shows today's AI calls (UTC day) against the daily cap `LLM_DAILY_CALLS`.

## Non-functional requirements and constraints

- **Security:** HTTPS only in production (Caddy). The password is compared in constant time (hash both values first, then `timingSafeEqual`). Sessions are not stored in SQLite and not written to disk. The admin bundle in the web app contains no secret; all protection is on the server.
- **Privacy:** No new personal data is collected. The fallback records (FR-016) hold no personal data, only technical reasons; they belong to their scan and must be deleted together with it once scan deletion exists (the 30-day deletion promised by the privacy notice is not implemented in `server/` yet, see feature 006 T-042). The list exposes device IDs, which act as access keys to result pages, so only an authenticated admin may see them.
- **Compatibility:** Works with the existing Caddy routes (`/api/*` to the server, everything else to the web app). `Secure` cookies work on `http://localhost` in current browsers, so local development needs no exception.
- **Performance:** The list query reads one page at a time and uses SQLite's JSON functions for the displayed fields; a few thousand scans need no index.
- **Design:** The login form and the table follow `docs/VISUAL_DESIGN.md` and the existing components.

## User journeys and edge cases

1. **Happy path:** A team member opens `/admin`, enters the credentials, and sees the newest 50 scans with the total. They open a result through the device link (a new tab), page back to older scans, and press **Log out**.
2. **Wrong password:** The form shows "Wrong username or password". After five failures the form says to try again later, with the waiting time.
3. **Not configured:** On a server without `ADMIN_USERNAME`/`ADMIN_PASSWORD`, or with a password under 16 characters, `/admin` says the admin area is not set up. A local developer sets both in `server/.env` and restarts.
4. **Session expiry or restart:** After 12 hours, or after a deployment, the next request answers 401 and the page returns to the login form.
5. **Old scans:** Scans from before feature 007 have no system; the column shows a dash.
6. **Attacker:** Someone guesses passwords from many addresses: the global limit stops all logins for the rest of the 15-minute window. The team can still read the database on the host meanwhile.

## Proposed technical approach

Proposal based on repository inspection on 2026-11-21; not adopted yet.

- **Routes** (`shared/src/api.ts` documents them, `server/src/admin/`):
  - `POST /api/admin/login` body `{ "username", "password" }` → 204 with the session cookie; 401 wrong credentials; 429 limited; 404 not configured.
  - `POST /api/admin/logout` → 204 and an expired cookie.
  - `GET /api/admin/session` → 200 `{ "username" }` or 401, so the page knows whether to show the form.
  - `GET /api/admin/scans?page=<n>` → 200 `{ "total", "page", "page_size", "scans": [{ "device_id", "created_at", "os_family", "manufacturer", "model", "scan_status" }] }`.
  - Response shapes as TypeBox schemas in `shared/` (ADR-001), exported like the others.
- **Configuration:** `loadAdminConfig(env)` in `server/src/admin/config.ts` reads the two variables, applies FR-001/FR-002, and returns `null` when disabled; `buildApp` registers the admin routes only when it is not null (404 otherwise, as Fastify does for unknown routes).
- **Sessions:** an in-memory `Map` of token → expiry; tokens from `crypto.randomBytes(32)` as base64url; expired entries pruned on access. A cookie helper sets and clears the cookie without adding a cookie plugin dependency.
- **Rate limits:** a sliding 15-minute counter per client IP (the same `trustProxy` setting as the other limits) and a global counter, alongside `server/src/limits.ts`. The per-client and global thresholds are constants in the plan's requirements; making them configurable is not needed.
- **Store:** `DeviceStore` gains `list(offset, limit)` and `count()`, selecting `device_id`, `created_at` and `json_extract` of the displayed fields.
- **Web:** a new `admin` route in `web/src/app/router.ts` and `web/src/pages/Admin.tsx` (login form, table, pagination, log out). `index.html` stays shared; the admin page sets `<meta name="robots" content="noindex">` at runtime, and the server or nginx adds `X-Robots-Tag: noindex` for `/admin` (open: nginx config change versus meta tag only). The live client gets admin calls with `credentials: 'same-origin'`; the mock client offers a sample list and accepts a fixed demo login for UI work.
- **Tests:** server tests for disabled admin (404), short password, wrong credentials (generic 401), per-client and global 429 with `Retry-After`, cookie flags, expiry, logout, 401 without a session, list order and paging, no-store header, JSON-only login, and the route inventory (the public list routes still do not exist; admin routes exist only when configured). Web tests for the form, the generic error, the table, pagination and log out.

- **Details and AI status (2026-11-21 revision):** `GET /api/admin/scans/:id` → `AdminScanDetail` with the `DeviceRecord` and an `ai` object (category results per use, step plan counts per use, fallbacks). `AdminScanPage` gains `ai_usage { day, used, cap }`. An `AdminInsights` module reads `category_cache`, `step_cache`, `llm_daily_usage` and a new additive table `ai_fallbacks`; a table that does not exist yet counts as empty. The category and step services get an optional `onFallback` callback, wired to the fallback log in `main.ts`. In the web app, Details opens below the row; the JSON is shown with `JSON.stringify(…, null, 2)` in a scrollable `<pre>`.

## Dependencies and risks

- **Risk (accepted by the user):** The password is stored in plain text in `.env` and visible in the container's environment. Anyone with root on the host or access to the deployment files can read it. The 16-character minimum and the rate limits protect against guessing from outside, not against that.
- **Risk:** The global login limit lets an attacker lock the team out of the admin page for 15 minutes at a time. Accepted as the trade-off against brute force; the database stays readable on the host.
- **Risk:** Device IDs on the admin page are access keys. A screen shared or a screenshot posted shows working links to people's results.
- **Dependency:** Rate limits per client need `TRUSTED_PROXY_IP` set correctly in production (`docs/DEPLOYMENT.md`); otherwise all clients share one counter and the per-client limit behaves like the global one.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review on the branch `feat/adminpage`, then a check on the deployed site after the next release.
- **Review:** Self-review of the final diff against this plan, with the authentication, session and rate-limit code checked in particular, recorded in `ACCEPTANCE_CRITERIA.md`. Because the page is public and security-relevant, an informal review by a team member is recommended; it is not required by repository policy.
- **CI/merge:** CI must pass. Required local checks: `npm run typecheck`, `npm test`, `npm run build`. Merging into `main` and releasing need the user's authorization.

## Release and recovery (when applicable)

- **Rollout:** Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (at least 16 characters) in `deploy/.env` on the host, then release and deploy as in [`docs/DEPLOYMENT.md`](../../DEPLOYMENT.md). Without them the admin area stays off, so the release is safe to deploy first.
- **Compatibility:** No schema or data migration; the list reads the existing `devices` table.
- **Recovery:** Removing the two variables and restarting the server switches the admin area off. Rolling back the image removes it entirely; no data changes either way.
- **Post-release checks:** `/api/admin/scans` without a session answers 401; a wrong login answers 401 and six quick wrong logins end in 429; a correct login lists the scans; `curl -I` shows `no-store` and the cookie flags. Release execution needs the user's authorization.

## Assumptions and open questions

- Assumption: one shared admin account for the team is enough for the hackathon.
- Assumption: the times shown in the viewer's local time are what the team wants; the stored value stays UTC.
- Open (non-blocking): whether `noindex` is sent as an `X-Robots-Tag` header by nginx for `/admin`, or only as a meta tag set by the page. Default: meta tag plus the header on all `/api/admin/*` responses.

## Scope change log

| Date       | Change                 | User approval                                                                                                                                                               |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | Initial approved scope | User asked for an admin page on `feat/adminpage`, chose "No IP", "Plain password in .env", "Login form + session" and "View only", and replied "accept", 2026-11-21 |
| 2026-11-21 | Revision before release (the feature is implemented on `feat/adminpage` but not merged or released): the exclusion "only the listed fields" is replaced by FR-013 to FR-017 (Details with the full scan JSON, AI status per scan, recorded AI fallbacks, AI calls today). The server records fallbacks in a new additive table. AC-020 to AC-026 and T-011 to T-015 added; all earlier requirements stay valid. | User chose "Full scan JSON" and "AI status", "Record fallbacks", and "Accept and implement", 2026-11-21 |

## Related and superseded features

The relationships below were **implemented on `feat/adminpage` on 2026-11-21** (commits "feat(server): add the admin login and scan list API" and "feat(web): add the admin login and scan list page"), with reciprocal notes in the earlier plans. They take effect on `main` and in production only after merge and release.

- [`feature-001-device-scan-and-upload`](../feature-001-device-scan-and-upload/PLAN.md) / FR-011 ("No endpoint lists or enumerates devices") and its out-of-scope entry "a list of all devices": replaced for an authenticated admin only (FR-011 here). For everyone else they stay in force, and the route inventory test keeps checking that. The privacy rule "never log full device IDs together with request IPs" is unchanged: no IPs are stored and the admin routes log no device IDs.
- [`feature-006-web-app`](../feature-006-web-app/PLAN.md) / FR-046 (privacy notice): its statement "sets no cookies" gains the admin-only exception (FR-012 here). The rest of the notice is unchanged.
- [`feature-005-public-demo-deployment`](../feature-005-public-demo-deployment/PLAN.md): the deployment guide and `deploy/.env.example` gain the two admin variables; the deployment itself is unchanged.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None yet; [ADR-001](../../adr/adr-001-shared-contracts-typebox.md) governs the new response schemas
