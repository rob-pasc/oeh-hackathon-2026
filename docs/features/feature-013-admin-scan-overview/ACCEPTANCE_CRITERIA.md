# Acceptance Criteria: Admin scan overview

- **Feature ID:** `feature-013-admin-scan-overview`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

Each row must specify **observable behavior**, a verification method, and actual evidence. Write criteria when specifying the feature; update result and evidence during implementation. Do not mark `Pass` based solely on code inspection or optimism.

When release or recovery checks are part of the approved scope, include rows for the relevant rollout, migration, post-release behavior, and recovery outcomes. Record the version, environment, command or observation, and evidence link. Passing local tests does not establish production success or recoverability. Required checks awaiting release stay `Not run` or `Blocked`; checks explicitly outside this feature's scope belong in the plan's release handoff, not in invented passing rows.

| ID     | Requirement | Scenario / expected outcome                                                                                                                                                                                      | Verification method                                     | Result  | Evidence |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------- | -------- |
| AC-001 | FR-001      | Without `ADMIN_USERNAME` or `ADMIN_PASSWORD`, every `/api/admin/*` route answers 404, and `/admin` says the admin area is not set up.                                                                             | Automated server and web tests                          | Not run | None yet |
| AC-002 | FR-001      | With both set, `/admin` shows a username and password form.                                                                                                                                                      | Automated web test, plus a browser check                | Not run | None yet |
| AC-003 | FR-002      | With a password of 15 characters, the admin routes answer 404 and the startup log has a warning that does not contain the password; the other routes work.                                                     | Automated server test                                   | Not run | None yet |
| AC-004 | FR-003      | The correct credentials give 204 and a session cookie; a wrong username and a wrong password each give the same 401 body; the form shows "Wrong username or password".                                         | Automated server and web tests                          | Not run | None yet |
| AC-005 | FR-003      | The credential check compares fixed-length digests with `timingSafeEqual`, so its work does not depend on how much of the input matches.                                                                         | Automated unit test of the comparison, plus code review | Not run | None yet |
| AC-006 | FR-004      | The sixth failed login from one client within 15 minutes gives 429 with a positive `Retry-After`, while another client can still log in.                                                                       | Automated server test with two client addresses         | Not run | None yet |
| AC-007 | FR-004      | After 50 failed logins from many clients within 15 minutes, a correct login from a new client gives 429 until the window ends; afterwards it succeeds.                                                          | Automated server test with a controllable clock         | Not run | None yet |
| AC-008 | FR-005      | The session cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/admin`, has a `Max-Age` of 12 hours, and its value has at least 256 bits of randomness.                                               | Automated server test of the `Set-Cookie` header        | Not run | None yet |
| AC-009 | FR-005      | A session stops working after 12 hours, after logout, and after the app is rebuilt (restart).                                                                                                                    | Automated server tests with a controllable clock        | Not run | None yet |
| AC-010 | FR-006      | Without a cookie, with a made-up token, and with an expired token, `GET /api/admin/scans` and `GET /api/admin/session` give 401 and no scan data; the page shows the login form.                               | Automated server and web tests                          | Not run | None yet |
| AC-011 | FR-007      | With 120 stored scans, page 1 lists the 50 newest in descending time, page 3 lists the last 20, the total says 120, and each row has the time, device link, maker, model, system and status.                  | Automated server and web tests                          | Not run | None yet |
| AC-012 | FR-007      | A scan without `os.family` and with null maker or model shows dashes, and the model column prefers the product name over the model code.                                                                      | Automated server and web tests                          | Not run | None yet |
| AC-013 | FR-008      | No admin route deletes or edits data: the route inventory has exactly the four admin routes, and none of them is `DELETE`, `PUT` or `PATCH`.                                                                     | Automated route inventory test                          | Not run | None yet |
| AC-014 | FR-009      | Admin responses have `Cache-Control: no-store`; `/admin` is marked `noindex`; a request log captured during a login and a list request contains no username, password, token or device ID.                     | Automated server tests with a captured log, web test    | Not run | None yet |
| AC-015 | FR-010      | A login posted as a form (`application/x-www-form-urlencoded`) or `text/plain` is rejected without starting a session.                                                                                          | Automated server test                                   | Not run | None yet |
| AC-016 | FR-011      | Without an admin session there is still no route that lists devices: the existing route inventory test passes for the public routes, and `/api/admin/scans` without a session gives 401.                        | Automated route inventory test                          | Not run | None yet |
| AC-017 | FR-012      | A visit to the landing, session, result, imprint and privacy pages sets no cookie; the privacy notice in German and English names the admin-only session cookie.                                              | Automated web test, plus a browser check                | Not run | None yet |
| AC-018 | Release     | On the deployed site: 401 without a session, 429 after six quick wrong logins, a working login, and the cookie flags and `no-store` in the response headers.                                                    | Manual `curl` and browser check after release           | Not run | None yet |
| AC-019 | Review      | Self-review of the final diff against the plan, covering authentication, sessions and rate limits, is recorded below with findings and their resolution.                                                       | Review record in this document                          | Not run | None yet |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

If a later feature supersedes this behavior, preserve these criteria, results, and evidence as historical records. Add a dated note under verification notes identifying the affected IDs and linking to the replacement feature's plan and acceptance criteria document. A historical `Pass` does not verify the replacement; its acceptance criteria document must record fresh evidence. See the supersession rules in `docs/workflow/CHANGE_HISTORY.md`.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review on `feat/adminpage`, then a check on the deployed site after release ([plan](./PLAN.md#review-and-integration)). No review has been performed yet.

## Verification notes

Not yet verified.
