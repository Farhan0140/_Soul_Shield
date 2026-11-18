# PROJECT_CONTEXT.md — Soul Shield

> **Purpose of this file:** a persistent, verified knowledge base of the entire project so any
> future session can make changes without re-deriving the architecture. Everything marked
> ✅ was verified by reading the actual code (not inferred from the README). Last full analysis:
> 2026-10-23 at git branch `v1.0.1` (clean tree, HEAD `43b386d`).
>
> **Maintenance rule:** whenever the project is modified, update the relevant section here.
> Never store secrets in this file — configuration is documented by *variable name only*.

---

## 1. Project purpose & overall architecture ✅

**Soul Shield** ("Your Daily Steps Towards Jannah") is a full-stack habit/worship task tracker:
users schedule recurring tasks (dhikr counters, study timers, checklist items, multi-step
sub-tasks), complete them per-date, earn custom reward messages, and get reminder notifications.

One Go REST API, two clients, plus a local-first sync protocol:

```
Web (React SPA) ──REST + JWT──────────► Go API ──sqlx/pgx──► PostgreSQL (Neon, hosted)
                                             ▲
Mobile (Expo) ◄─► on-device SQLite (Drizzle) ┘ via GET/POST /sync (delta pull / batch push)
                     (source of truth for every mobile read/write)
```

- **Web** talks plain REST with a JWT bearer (`Authorization: JWT <token>`).
- **Mobile** is *local-first*: its SQLite store is authoritative for reads/writes; the server is
  reconciled through a delta-sync protocol. Almost all mobile writes go through `POST /sync`,
  not the per-action REST endpoints.
- Backend deploys on **Render** (free tier, sleeps → the mobile retry policy exists for this);
  web deploys on **Vercel** (`vercel.json` SPA rewrite); DB is **Neon** Postgres.

---

## 2. Monorepo layout ✅

```
F:\Soul_Shield\
├── README.md                  # rich overview (mostly accurate; see §12 for drift)
├── package.json / package-lock.json   # EMPTY placeholder ({}) — not a real workspace; each sub-project is standalone
├── PROJECT_CONTEXT.md         # this file
├── soul-shield/               # Go 1.25 REST API  (module name: soulsheld)
├── soul-shield-client/        # React 19 + Vite 8 web dashboard
└── soul-shield-mobile-app/    # Expo SDK 54 / React Native 0.81 / TypeScript app
```

### Backend — `soul-shield/`
| Path | Purpose |
|---|---|
| `main.go` | Entry: sets Swagger host to `RENDER_EXTERNAL_HOSTNAME` (https) when on Render, then `cmd.Serve()` |
| `cmd/serve.go` | Bootstraps everything (config → DB → migrations → repos → handlers → server) |
| `config/config.go` | Env-driven `Config` (godotenv when `ENV != production`; exits on missing required vars) |
| `infra/db/connection.go` | sqlx DB over pgx driver; `NewConnection(connStr)` is the one actually used (Neon URL from `CONN_STRING_FOR_DB`); `NewConnectionOffline` (per-field DSN) exists unused |
| `infra/db/migrate.go` | sql-migrate runner, `migrate.Up` on `./migrations`, runs on every startup |
| `migrations/000001_init_schema.sql` | Single baseline schema (replaced 20 legacy migrations). **Never edit once applied — append `000002_...`** |
| `migrations/000002_add_sub_task_description.sql` | Adds nullable `sub_tasks.description` TEXT (2026-10-23, sub-task descriptions feature) |
| `migrations/000003_user_push_tokens.sql` | `user_push_tokens` (user FK, UNIQUE token, platform) for cross-device sync-alert pushes (2026-10-24) |
| `migrations/000004_token_version.sql` | `users.token_version INT NOT NULL DEFAULT 0`: bumped on password change/reset, revokes older JWTs (2026-11-18) |
| `repo/` | Data access layer, one file per aggregate (see §5) |
| `rest/server.go` | Global middleware chain + `http.ServeMux` registration + Swagger route + ListenAndServe (port = env `PORT` → fallback `HTTPPORT`) |
| `rest/middlewares/` | `Manager` (compose chain), `Preflight`, `Cors`, `Logger`, `AuthenticateJWT`, `RequireRole` (⚠ defined but never used), `middleware.go` (struct) |
| `rest/handlers/user/` | register / login / verify-security-answer / reset-password / me |
| ~~`rest/handlers/opt/`~~ | **Removed 2026-11-18** (S2): the unauthenticated `/send-otp` + `/verify-otp` routes could send unlimited email to any address. The leftover `repo/otp.go`, `util/mail.go`, `util/otp.go` (and gomail) were deleted in the Low pass (C6) |
| `rest/handlers/task/` | 14 files: routes, create/update/delete, list (date), history, list-by-category (paginated), mine (flat), reorder, complete, increment, sub-task complete/increment, sub-task merge/derive, add-to-my-tasks (id + by-uuid), mapper, dto |
| `rest/handlers/category/` | CRUD + reorder |
| ~~`rest/handlers/quran/`~~ | **Removed 2026-11-18** (B20): no client used it (the mobile daily verse reads the external quranapi.pages.dev). `repo/quran.go` deleted too; the `quran_*` tables are kept (no destructive migration) |
| `rest/handlers/sync/` | pull/push handlers + DTO passthrough |
| `util/` | `jwt.go` (auth 30-day JWT + scoped 15-min reset JWT), `errors.go` (sentinel errors), `send_data.go` (JSON writers), `constants.go` (recurrence/status consts), `request.go` (`ClientIP`: `TRUSTED_PROXY_HOPS`-aware, see §4) |
| `docs/` | **Generated** Swagger spec (swaggo) — don't hand-edit |
| `.env` | Real config, present locally (values NOT recorded anywhere in analysis) |
| `.env.example` | Template: `SECRETKEY, CONN_STRING_FOR_DB` (required); `HTTPPORT, CORS_ORIGINS, TRUSTED_PROXY_HOPS, VERSION, SERVICENAME` (optional); `TEST_DATABASE_URL` (tests) |

### Web — `soul-shield-client/`
| Path | Purpose |
|---|---|
| `vite.config.js` | react + tailwindcss plugins, nothing custom |
| `vercel.json` | SPA rewrite `/.* → /index.html` |
| `src/main.jsx` | Provider tree: BrowserRouter → ThemeProvider → ApiProvider → AuthProvider → ToastProvider → LazyMotion/MotionConfig → App |
| `src/App.jsx` | Route table (unknown URLs → `NotFound`; the duplicate catch-all was removed in the Low pass, B12) |
| `src/services/api.js` | Fetch wrapper: base `VITE_API_URL` (default localhost:3000), token from `localStorage['soulshield_token']`, sends `X-Timezone`, stores `X-Refreshed-Token`, 401 → `soulshield:session-expired` event, cold-start retries (idempotent requests) + wake-up status for `ServerWakeBanner`, error humanization maps |
| `src/context/` | `ApiContext.jsx` (all endpoint wrappers), `AuthContext.jsx` (session), `ThemeContext.jsx` + `themes.js` (10 themes via `data-theme`) |
| `src/hooks/` | `useTasks` (day list + date nav), `useCounter` (debounced counter batching), `useTimerTask` (web timer, localStorage), `useHistory`, `useAdminTasks`, `usePersonalStats` |
| `src/pages/` | Dashboard, History, Categories, CategoryDetail, Profile, AdminTasks, TaskTimer, Login/Register/ForgotPassword/AuthLayout, NotFound |
| `src/components/` | TaskCard, TaskFormModal (create/edit + sub-tasks incl. descriptions), SubTaskList (paginated + collapsible completed section), ExpandableText, CounterWidget, RewardModal, CategoryRow/Card/FormModal, ProgressSummary, Heatmap, ChangePasswordModal, ConfirmModal, Toast, Sidebar/MobileBottomNav/AppLayout, ui/Button+Input |
| `dist/` | Local build output (git-ignored, not committed; Vercel builds from source) |

### Mobile — `soul-shield-mobile-app/`
| Path | Purpose |
|---|---|
| `app/` | expo-router file routes: `(auth)/login|register|reset-password`, `(tabs)/index|history|categories|create|profile|admin/tasks`, modals `task/[id]/edit|new`, `category/[id]|new`, `counter/[taskId]`, `timer-task/[taskId]`, `timer` (focus timer), `reorder/*`, `sync-notifications` |
| `app/_layout.tsx` | Root: fonts, notification setup, background-task registration, foreground sync trigger, deep-link for timer notifications, provider tree |
| `api/` | Thin REST wrappers: `client.ts` (fetch + timeout + retry), `auth.ts`, `tasks.ts`, `categories.ts`, `sync.ts`, `sync-types.ts`, `types.ts`, `quran-client.ts`, `quran-content.ts` (external quranapi.pages.dev) |
| `lib/db/` | **On-device SQLite store**: `schema.ts` (Drizzle), `client.ts` (`getLocalDb()`, `clearLocalDatabase()`), `migrations.ts` (PRAGMA user_version), per-table repos (`tasks-repo.ts`, `sub-tasks-repo.ts`, `categories-repo.ts`, `completions-repo.ts`, `conflicts-repo.ts`), `sync-cursor.ts`, `sync-push-builders.ts`, `json-array.ts`, `uuid.ts`, `contract-check.ts` (dev-only diff vs server) |
| `lib/background-sync/` | **Sync engine**: `sync.ts` (orchestrator), `pull.ts`, `push-pending.ts`, `retry.ts`, `state.ts`, `sync-status.ts`, `task.ts` (headless daily job), `timer-task.ts` (headless timer completion), `time.ts` (Asia/Dhaka window) |
| `lib/mutation-defaults.ts` | The single choke point every push runs through (`pushChanges`) + all headless-replayable `*MutationFn`s + `registerMutationDefaults()` |
| `hooks/queries/` | `use-tasks.ts` (local-first reads), `use-task-mutations.ts`, `use-category-mutations.ts`, `use-daily-verse.ts` |
| `hooks/` | `use-task-increment-buffer.ts` (counter tap batching), `use-task-timer.ts`, `use-timer.ts` (focus timer), `use-network-status.ts`, `use-background-sync-status.ts`, `use-task-reminders-sync.ts` |
| `lib/` | `notifications.ts` (weekly local reminders), `network.ts` (onlineManager + reconnect sync), `persister.ts` (AsyncStorage query cache + paused mutations), `query-client.ts`, `query-keys.ts`/`mutation-keys.ts`, `secure-store.ts`, `timer-task/`, `timer/`, `daily-verse.ts`, `date.ts` |
| `components/` | task/counter/timer/categories/filters/history/dashboard UI (ThemedText/View, haptic tab, etc.) |
| `.expo/`, `android/` | Generated build artifacts |
| `eas.json`, `app.json` | Expo/EAS config |

⚠ In git, mobile writes are keyed to nothing else — **the mobile app requires a custom dev
build** (`npx expo run:android`) because `expo-sqlite`/`expo-crypto` don't work in Expo Go.

---

## 3. Tech stack ✅

| | Backend | Web | Mobile |
|---|---|---|---|
| Language | Go 1.25.3 | JavaScript (ESM) | TypeScript |
| Framework | `net/http` + Go 1.22 method-pattern ServeMux | React 19 + Vite 8 + react-router-dom v7 | Expo SDK 54, expo-router v6, RN 0.81 |
| Data | PostgreSQL (Neon) via `sqlx` + `pgx/v5`; migrations `rubenv/sql-migrate` | none (API-only) | `expo-sqlite` + `drizzle-orm` (local store); TanStack Query v5 (+ AsyncStorage persister) |
| Auth | `golang-jwt/v5` (HS256); bcrypt (`golang.org/x/crypto`) | JWT in `localStorage` | JWT + cached profile in `expo-secure-store` |
| UI extras | swaggo/http-swagger docs | Tailwind CSS 4 (`@tailwindcss/vite`), Framer Motion, lucide-react | Reanimated 4, expo-notifications (local only), expo-background-task/WorkManager, netinfo, haptics, svg, reanimated-worklets |
| Tests | `go test ./...` (handlers/user, util, repo/pgerr, task parent-status) | none (lint + build in CI) | `npm test` (Node test runner: parent-status, local-owner rule) + dev-only `contract-check.ts` |

---

## 4. Configuration & environment ✅

**Backend env** (`config/config.go`; the process exits with a message if a required one is
missing or invalid): required `SECRETKEY`, `CONN_STRING_FOR_DB`; optional `HTTPPORT` (default
3000), `CORS_ORIGINS` (comma list, `*` = any; default the Vercel site + localhost:5173/4173),
`TRUSTED_PROXY_HOPS` (default 0 = leftmost `X-Forwarded-For`, spoofable; set only after checking
the host's header layout), `VERSION`/`SERVICENAME` (informational). The old `DB_*`/`SMTP_*` vars
are no longer read (Low pass, C6). `.env` loaded only when `ENV != "production"`. Runtime listen port: env `PORT` (Render) → fallback `HTTPPORT`.
DB pool: max open 10 / idle 5 / lifetime 5 min.

**Web**: `VITE_API_URL` (default `http://localhost:3000`), `localStorage['soulshield_token']`,
theme in `localStorage['soulshield_theme']`.

**Mobile**: `EXPO_PUBLIC_API_URL` (env.d.ts); SecureStore keys `soulshield_auth_token`,
`soulshield_cached_user`, `soulshield_remembered_email`, `soulshield_theme`,
`soulshield_arabic_font`; AsyncStorage keys `SOULSHIELD_QUERY_CACHE`,
`soulshield_background_sync_state`, `soulshield_task_reminder_ids`,
`soulshield_pending_increment_<taskId>_<date>`; SQLite db `soulshield_local.db`.

---

## 5. Backend deep-dive ✅

### 5.1 Boot sequence (`cmd/serve.go`)
`config` → `db.NewConnection(CONN_STRING_FOR_DB)` → `db.MigrateDB` → construct repos
(user, task, subTask, category, push, sync, admin stats) → handlers (user takes cnf+repos+middlewares;
task takes task+subTask+category+push repos; category takes category+push) →
`rest.NewServer(...).Start()`, which shuts down gracefully on SIGTERM/SIGINT (25 s drain).
Migrations run on every boot (fine for the single Render instance).

### 5.2 Auth & security model
- JWT HS256 (alg pinned), **14-day sliding sessions** (2026-11-18; was 30 days). Claims: `ID,
  Full_Name, Email, Role, ver (token_version), typ="auth"` + registered claims. Header scheme is
  `Authorization: JWT <token>` (not Bearer). Tokens older than 24h get a renewed one in the
  `X-Refreshed-Token` response header (both clients store it). `AuthenticateJWT` checks the
  token's `ver` against `users.token_version` (DB) and takes the **role from the DB**, not the
  token; a DB error answers 503 (never 401, which would sign clients out). Reset tokens
  (`purpose=password_reset`) are refused as sessions and are single-use (`ResetPassword` bumps
  `token_version` with a compare-and-set).
- `AuthenticateJWT` middleware puts `userID` (int64) and `role` (string) into request context.
- `RequireRole` middleware: **defined, never used** (dead code). Instead each handler checks
  role where needed (`CreateTask` rejects non-admin `is_global`; `checkOwnership` in repo allows
  admin to edit/delete anything).
- Passwords & security answers are bcrypt-hashed (`DefaultCost`).
- **Password reset flow**: `POST /users/verify-security-answer` → `userRepo.VerifySecurityAnswer`
  (S10b, Low pass: failures are counted from `security_answer_attempt_logs` per email+IP —
  5 from one IP or 20 from all IPs within 24h → locked — under a `FOR UPDATE` row lock, so a
  stranger can't lock the owner out and parallel guesses can't skip the count; a success resets
  the count. The old `users.security_answer_*` counters are now unused. Deliberately generic
  error messages to prevent enumeration) → returns 15-min
  `ResetPasswordClaims` JWT (`purpose=password_reset`) → `POST /users/reset-password` redeems it
  (verifies purpose+email, then `userRepo.Update` rehashes and resets otp flag). No email/OTP.
- **Registration**: `POST /users/register` requires `security_answer` (3–100 chars). Email
  verification is NOT enforced (the code that checked `email_otps.verified` is commented out in
  both handler and repo; `Create` still writes `verified=false` inside its tx — vestigial).
- `GET /users/me`: re-parses the Authorization header itself (duplicates middleware logic) and
  returns claims + `created_at` from DB.
- 401 auto-handling exists only on mobile (global ApiError handler → logout keeping local data).
  Web treats 401 as a message.

### 5.3 Complete route table ✅ (from `routes.go` files, Go 1.22 patterns)

Unauthenticated: `POST /users/register`, `POST /users/login`,
`POST /users/verify-security-answer`, `POST /users/reset-password`. (The OTP routes were
removed 2026-11-18.)

**Auth hardening (2026-11-18):** in-memory sliding-window rate limits (`util/ratelimit.go`,
wired in `rest/handlers/user/handler.go`): login 30/15min per IP + 10/15min per email,
register 10/h per IP, verify-security-answer 20/15min per IP, reset-password 10/15min per IP,
change-password 10/15min and delete-account 5/15min per user → **429** + `Retry-After`.
Per-process state (single Render instance); move to a shared store if ever scaled out.
Login answers the SAME 401 "Incorrect email or password" for an unknown email (was a 500).
Register returns a `RegisterResponse` DTO `{id, full_name, email}`; `repo.User.Password` is
`json:"-"` (it used to leak the bcrypt hash). `POST /users/change-password`
`{current_password,new_password}` and `DELETE /users/me` `{password}` (hard delete; all user
data cascades; email-keyed `email_otps` / attempt logs deleted explicitly; **admins refused with
403** because `tasks.created_by` of global tasks has no ON DELETE). Wrong password on both →
**400, never 401** (mobile signs out on any 401). New passwords: 6–72 chars
(`util.ValidateNewPassword`, change-password only so far).
Global (all routes): Preflight → Cors (allow-list from `CORS_ORIGINS`) → LimitBody → Recover → RequestLogger. Swagger: `/swagger/`.

**Login contract (fixed 2026-10-24):** wrong password now returns **401**
`{"error": "Incorrect email or password"}` via `util.ErrInvalidCredentials` (previously a
misleading 400 "Internal Server Error"); success returns **200** (was 201). The mobile login
screen already mapped 400/401 to friendly copy via `lib/errors.ts`'s CONTEXT_MESSAGES.

**Push tokens (2026-10-24, #19; reworked 2026-11-18, B5):** `POST /users/push-token` `{token, platform}` (upsert by
unique token) and `DELETE /users/push-token` — registered devices are stored in
`user_push_tokens` (repo/push.go). Every successful REST **task** mutation (complete, increment,
create, update, delete, sub-task complete/increment, add-to-my-tasks) fires
`pushRepo.NotifyDataChange(userID)` — an async best-effort fan-out to Expo
(`exp.host/--/api/v2/push/send`, "data changed" payload `data.type = 'data-change'`) telling the
user's OTHER devices to catch-up-sync. Since 2026-11-18 the push is **data-only** (no
title/body, `priority: high`, `_contentAvailable`, TTL 1h) and **debounced to one per user per
30 s** with a trailing send (in-memory). Data-only pushes never reach JS listeners, so the
mobile app handles them in a `Notifications.registerTaskAsync` task
(`lib/background-sync/data-change-task.ts`, imported by app/_layout.tsx) that runs
`runFullBackgroundSync`. Best-effort (failures are logged, never surfaced).

JWT-protected:

| Method & path | Handler → repo notes |
|---|---|
| `GET /users/me` | claims + created_at |
| `POST /tasks` | validation → `taskRepo.Create` → optionally `subTaskRepo.ReplaceForParent` (failure ⇒ compensating soft delete of the just-created task) |
| `GET /tasks?date=` | `ListForDate` + `attachSubTasksForDate` + `already_added` bulk flag |
| `GET /tasks/history?from=&to=` | default from = to−6; `ListForRange` + `attachSubTasksForRange` |
| `GET /tasks/mine` | `ListAllOwnedFlat` (personal tasks only, unfiltered) + sub-tasks + category uuid resolution |
| `GET /categories/{categoryId}/tasks?date=&page=&page_size=` | full list then **active-first/completed-last split after parent-status derivation**, in-memory pagination (page_size default 10, max 100), returns `PaginatedTasksResponse` |
| `PATCH /tasks/reorder` | exact ID-set match ⇒ `ErrOrderMismatch` → **409**; positions = array index |
| `PATCH /tasks/{id}` | partial update + optional full sub-task list replace (`sub_tasks: []` clears, absent = untouched) |
| `DELETE /tasks/{id}` | **soft delete** + explicit soft-delete cascade to sub_tasks |
| `POST /tasks/{id}/complete` | upsert completion 'completed' (`ON CONFLICT (task_id,user_id,task_date) DO UPDATE`); body `{date?}`; rejects counter tasks (`ErrNotCounterTask`) and unscheduled dates |
| `POST /tasks/{id}/increment` | counter only; additive `progress_count` in tx; auto-complete at target (one-way); reward_text attached when completed |
| `POST /tasks/{id}/add-to-my-tasks` | clone global→personal (shared `addToMyTasks`) |
| `POST /tasks/by-uuid/{uuid}/add-to-my-tasks` | same, mobile uuid route |
| `POST /tasks/{taskId}/subtasks/{subTaskId}/complete` | sub completion upsert + recompute parent status + parent reward |
| `POST /tasks/{taskId}/subtasks/{subTaskId}/increment` | sub increment + parent recompute |
| `POST /categories`, `GET /categories` | create (default color `#CCCCCC`, hex-validated, unique per owner → 409) / list (position order) |
| `PATCH /categories/reorder` | exact ID-set match → 409 |
| `PATCH /categories/{id}` | owner-only update |
| `DELETE /categories/{id}` | soft delete + `UPDATE tasks SET category_id = NULL WHERE category_id = $1` (uncategorize) |
| `GET /sync?since=RFC3339` | delta pull (below) |
| `POST /sync` | delta push (below) |

### 5.4 Core business rules (verified in repo/handler code)

- **Recurrence**: `recurrence_days` smallint array, 0=Sunday..6=Saturday. `daily` force-sets all
  7 days on create/update. Empty days → `ErrInvalidRecurrence`. A date matches when its
  `EXTRACT(DOW)` is in the array. Sub-tasks inherit the parent's schedule (no own recurrence).
- **Sub-tasks** (added 2026-10-23: descriptions): `ReplaceForParent` — matched `id`s update
  (description, title, type, target/duration, position), new entries insert, missing entries
  soft-delete. Each sub-task carries an **optional description** (`sub_tasks.description`,
  migration 000002). ALL write paths now use full-row semantics — REST `PATCH /tasks` (web form
  always includes `description` on every sub-task; null/absent clears it) and the `/sync` push
  path (`pushSubTask`) assign the column directly. Local reorder flows on mobile preserve
  descriptions by omitting the field (`undefined` = keep, per `SubTaskInput`'s documented
  semantics). Trade-off note: only a pre-description web bundle would wipe a description on
  edit, and that window closes on client reload.
- **Task types** (DB CHECK `chk_task_type_fields`): `normal` (no target/duration), `counter`
  (target>0, no duration), `timer` (duration>0, no target). Server enforces via CHECK + repo
  validation + handler validation (three layers).
- **Completion status derivation**: stored statuses are only `pending|completed|missed`
  (CHECK). A missing completion row = `missed` if `date < today` (server clock) else `pending`.
  `partially_completed` is **never stored** — derived at read time from sub-tasks
  (`computeParentStatus`: all done→completed, some→partially_completed, none→missed/pending).
  A parent with sub-tasks always shows the derived status; its own completion row (if ever
  created via API) is ignored on read.
- **Rewards**: `reward_text` is surfaced ONLY when the task/status is completed (all list
  queries + `attachSubTasks*` + Complete/Increment responses).
- **Global (fixed) tasks**: `is_global=true` admin-created, `owner_id NULL`
  (CHECK `chk_task_owner`). Visible to every user in lists. `already_added` flag computed in
  `ListTasks` via lineage (`source_task_id`) OR case-insensitive trimmed title match against the
  user's references. Add-to-my-tasks clones the task + sub-tasks, reuses (case-insensitive) or
  creates a personal category with the admin category's name/color, sets `source_task_id`.
- **Reorder**: full ordered-ID contract; exact set match else 409 (`sameIDSet` helper shared by
  category + task repos).
- **Soft delete everywhere**: tasks cascade
  soft-delete to sub_tasks; deleting a category nulls `tasks.category_id`; completions keep
  snapshot titles and `task_id SET NULL` only via historical hard deletes.

### 5.5 Sync protocol (`repo/sync.go`, `repo/sync_push.go`, `rest/handlers/sync/*`)

**Pull** `GET /sync?since=`:
- Cursor = `SELECT now()` captured BEFORE reading rows → strict `updated_at > since` filters;
  anything committed concurrently is picked up next pull (no pagination by design — per-user
  data is small).
- Returns `SyncSnapshot{cursor, tasks, categories, sub_tasks, task_completions,
  sub_task_completions}` with **tombstones included** (no `deleted_at IS NULL` filter here —
  unlike every other repo read) and all relationships resolved to UUIDs
  (`category_uuid`, `parent_task_uuid`, `task_uuid`, `source_task_uuid`).

**Push** `POST /sync` `{changes: [{resource, op, uuid, client_updated_at, data}]}`:
- Resources: `tasks, categories, sub_tasks, task_completions, sub_task_completions`. Ops:
  `upsert`, `delete` (+ `increment` for both completion resources).
- Per-change result: `accepted` (applied; `server_row` = authoritative echo) / `superseded`
  (server `updated_at` won LWW; `server_row` = server version to reconcile) / `rejected`
  (resource-specific failure with `error` text; does NOT abort the batch). Data-rule failures
  (SQLSTATE class 23) are per-change rejections naming the constraint; infrastructure errors
  abort the whole request. Each `pushOne` autocommits (no batch transaction — by design).
- **Per-change rejection (2026-11-18)**: SQLSTATE class 22 (data exception: bad date, malformed
  uuid, out-of-range number) is now treated like class 23 → that change is `rejected`
  (`isRejectableDataError` in `repo/pgerr.go`) instead of failing the whole batch with 500,
  which used to make the client retry the same poisoned batch forever.
- **Idempotency**: unique violation on `*_uuid_key` = same change already landed → treated as
  accepted success.
- **Conflict rule**: LWW via `client_updated_at.Before(existing.UpdatedAt)` for everything
  EXCEPT `op:"increment"`, which is purely additive (`progress_count = progress_count + amount`)
  and additionally flips `pending → completed` once `progress >= target` (one-way, discovered
  bugfix — an increment alone used to never complete).
- **Scoped UUID resolution** (`resolveTaskID`/`resolveCategoryID`/`resolveSubTaskID` global-or-
  owned; `resolveOwnedTaskID` for NEW sub-tasks = strictly owned non-global) prevents adopting
  or referencing other users' rows. New sub-tasks can never be injected under a global task by
  a regular user.
- Push normalization: `reminder_time: ""` → NULL (CHECK constraint compatibility).

---

## 6. Database ✅

Postgres on Neon; single baseline migration `000001_init_schema.sql`. Conventions baked in:
`id BIGSERIAL` (REST/numeric world) + `uuid UUID UNIQUE` (sync/mobile world) on every synced
table; `deleted_at` soft delete; `updated_at` maintained by trigger `set_updated_at()`; all
timestamps `TIMESTAMPTZ`.

Tables & relationships:
- `users` (email lower/trim CHECK + UNIQUE, role `user|admin`, security answer hash/attempts/lock)
- `email_otps` (unique email, bcrypt otp, `verified` flag — no code uses it since the OTP removal; kept)
- `security_answer_attempt_logs` (email, success, ip, indexed by email)
- `categories` (owner FK CASCADE, partial-unique `(owner_id, name) WHERE deleted_at IS NULL`,
  position) — the partial unique index is why delete-then-recreate a same-named category works
- `tasks` (owner nullable for global, `created_by` non-null, category FK **SET NULL** (legacy hard
  delete path), `source_task_id` self-FK for lineage, position, CHECKs `chk_task_owner` +
  `chk_task_type_fields`, recurrence CHECK `recurrence_days <@ ARRAY[0..6]`, reminder_time regex
  CHECK) + indexes for (owner, category, position), global, updated_at
- `sub_tasks` (parent FK CASCADE, same type CHECKs, position, **nullable description TEXT** —
  migration 000002, 2026-10-23)
- `task_completions` — UNIQUE `(task_id, user_id, task_date)` is what merges web REST writes and
  mobile sync pushes onto one row per day; snapshot columns `task_title_snapshot`,
  `was_global_snapshot`; `progress_count >= 0` CHECK
- `sub_task_completions` — UNIQUE `(sub_task_id, user_id, task_date)`, plus `parent_task_id` FK
  CASCADE and `(parent_task_id, user_id, task_date)` index
- `quran_last_read` (PK user_id), `quran_bookmarks` (UNIQUE owner+verse, note) — **orphaned**:
  the API that used them was removed (B20); tables kept

Ops notes: deleting a category sets `tasks.category_id = NULL` explicitly in app code (soft
delete can't fire the FK's ON DELETE); deleting a task soft-cascades sub-tasks explicitly.

---

## 7. Web client deep-dive ✅

### 7.1 Data flow
`pages/components → use* hook → ApiContext wrapper → services/api.js fetch` (JWT header, 15s
timeout, humanized errors). No client-side cache library; `useTasks` keeps the day's tasks in
local state with `updateTask/removeTask/addTask` patch helpers.

### 7.2 Key behaviors
- **Dashboard**: date navigation (any day viewable), status filter (`FilterRow`), sections:
  Fixed Tasks (is_global, not already_added), one row per category ("Uncategorized" extra),
  Completed row. Rows navigate to `CategoryDetail` (`?name=&date=`), which re-queries and lists
  task cards (`fixed` pseudo-section shows template cards with Add-to-Your-Own-Tasks).
- **TaskFormModal**: recurrence picker (daily forces all days), type switch (Normal/Counter/
  Timer) with target/duration inputs (hours+minutes → `duration_seconds`), reward text, sub-task
  toggle (Normal parent only — switching type drops sub-task rows). Edit with sub-tasks disabled
  sends `sub_tasks: []` explicitly to clear (PATCH semantics).
- **TaskCard**: checkbox only for normal task-less-subtasks; `completeTask` on click (disabled
  for completed/missed); CounterWidget (`useCounter`: taps +1/+10/+33 batch locally, flush to
  `/increment` after 3s inactivity / tab hide / unmount; rollback + re-queue on failure);
  timer tasks navigate to `/tasks/:taskId/timer` (TaskTimer page + `useTimerTask`: timestamp-
  based countdown persisted to localStorage per task+subTask+date, auto-dispatch `complete`/
  `completeSubTask` exactly once at zero via `completionDispatched` flag; retries failed
  completion on mount and on `online` event); SubTaskList completes/increments sub-tasks and
  shows parent reward via `parent_status`/`parent_reward_text` response fields; RewardModal.
- **Profile**: ChangePasswordModal (⚠ broken, §12), theme picker, stats (`usePersonalStats`:
  365-day history → completion rate, streak, favorite category, best weekday).
- **Parity with mobile's sub-task features** (added 2026-10-23):
  - `SubTaskList.jsx` mirrors the mobile presentation: incomplete sub-tasks only, paginated
    **2 per page** with inline Previous/Page-N-of-M/Next controls (page clamped when the list
    shrinks), and a collapsible **"Completed Sub-Tasks (N)"** section (collapsed by default;
    completed normal sub-task rows remain tappable to un-complete via the same
    `completeSubTask` toggle). Parent status still comes from the server's `parent_status`.
  - Sub-task descriptions end-to-end: `TaskFormModal` has an optional multi-line Description
    field per sub-task draft (always sent; emptied → null = clear — REST replaces the whole
    list with full-row semantics, matching mobile), prefilled on edit.
  - `components/ExpandableText.jsx` = the web twin of the mobile primitive: line-clamps to
    `maxLines` (measured via scrollHeight vs clientHeight, re-measured on resize), click
    toggles, and only claims the click when actually truncated/expanded — otherwise clicks
    pass through (card details toggle, timer-row routing).
  - Expand/collapse applied to: TaskCard title + card description, sub-task rows (title +
    description), and the TaskTimer page header — which now follows the details hierarchy:
    parent task title on top, current task title in the SAME text-lg bold style, description
    below the current title (sub-task timers show `subTask.description`).
- **History**: DateRangePicker + per-day groups + Heatmap + stats (`useHistory`).
- **AdminTasks**: admin-only page (client-side guard `ProtectedRoute adminOnly`; server enforces
  again on each mutation). Lists today's `is_global` tasks; usage stats approximated from the
  admin's *own* 30-day history (see §12).
- **Auth pages**: Register (2-step email→account; calls `registerUser` with all 4 args
  directly — the unused `AuthContext.register` wrapper was removed, B13), ForgotPassword (verifySecurityAnswer → resetPassword two-step).

---

## 8. Mobile app deep-dive ✅

### 8.1 Local-first architecture (the critical part to understand before changing anything)

**Reads**: `useTasksQuery(date)` / `useTaskHistoryQuery` / `useMyTasksQuery` call
`deriveTasksForDate/Range` / `deriveManageableTasks` (pure JS over flat SQLite queries in
`tasks-repo.ts` — a deliberate port of backend `ListForDate/ListForRange` + `attachSubTasks*` +
`already_added` logic). `networkMode: 'always'` — these never need the network. Falls back to
legacy REST only when `getLocalDb()` is null (pre-rebuild devices).

**Writes** (all resources): local SQLite write happens synchronously *first* inside the hook's
`mutate()` (this is the onMutate-equivalent), then the query lists are invalidated, then a
TanStack mutation is dispatched. Offline ⇒ mutation pauses and is persisted (AsyncStorage,
`PERSIST_BUSTER 'v3'` — bump this whenever persisted mutation/query shapes change!) and replays
headlessly on reconnect/restart via `registerMutationDefaults`, whose `*MutationFn`s read the
**current** local row(s) by uuid and push — never the original input.

- `uuid` v4 generated client-side (`lib/db/uuid.ts`, expo-crypto) at create time; the same uuid
  keys the local row and the eventual sync push.
- `syncedAt` column: null = dirty (owes a push); set after the server confirms (via
  `reconcilePushResults` folding `server_row` back in — this is also what applies superseded
  server wins locally).
- `checkForConflict` (in every `upsert*FromSync`): if a pulled row would overwrite a local row
  that is still dirty (`syncedAt === null`) and differs, both versions are logged to
  `sync_conflicts` (no UI — deliberate Phase 4 scope; server still wins).
- `pushChanges()` is a serialized global queue (prevents the mutation-vs-sweep INSERT race);
  it also drives the "Syncing…/Synced/Sync failed" indicator via `beginSyncActivity/
  endSyncActivity`.
- `pushPendingLocalChanges()` (start of every sync, push-before-pull) is the **safety net**
  re-pushing ALL dirty rows (categories → tasks → sub-tasks → completions; tombstones as
  delete ops; counter completions with `progressCount > 0` excluded — they only sync as
  increments).
- Completion semantics on mobile differ from REST: `toggleTaskCompletionLocal` makes the
  checkbox a genuine toggle (sync `op:"upsert"` supports `pending`), while
  `completeTaskLocal` (used by headless timer completion) is idempotent non-toggle.
- Only REST-direct (online-only) mobile mutation left: `useAddTaskToMyTasks`
  (`POST /tasks/by-uuid/{uuid}/add-to-my-tasks`) followed by an immediate opportunistic pull.

**Counter taps** (`use-task-increment-buffer.ts`): per (taskId,date) shared buffer (list page +
counter page share it; recovered-from-AsyncStorage once per session; flushed when last instance
unmounts, on app-state change, or after 4s debounce). Each tap immediately writes SQLite
(`incrementTaskCompletionLocal`) and patches the query caches; the flush pushes the accumulated
delta as `op:"increment"`. Bookkeeping distinguishes "pending" vs "excluded" (excluded = already
owned by react-query's persisted-mutation replay) to prevent double-counting across an app kill.

### 8.2 Sync scheduling (all verified)
1. **Foreground opportunistic**: `runForegroundSyncIfDue` on app launch + every AppState→active
   (5-minute cooldown). Coalesced single-flight (`syncInFlight`).
2. **Reconnect** (`lib/network.ts`): resumePausedMutations → invalidate all → full sync.
3. **Headless daily**: `expo-background-task` (WorkManager, minInterval 15 min) — runs on every
   wake: first `checkAndCompleteFinishedTaskTimers` (any time of day), then the sync **only**
   inside 01:00–06:00 **Asia/Dhaka** and only if not already succeeded today
   (`lastSuccessDhakaDate` in AsyncStorage via `recordSyncOutcome`).
4. Sync order: online/signed-in guards → `pushPendingLocalChanges` (failure remembered, doesn't
   stop pull) → **pull** (critical; throws on failure) in parallel with best-effort
   `fetchMe` + 3-day daily-verse prefetch (external quranapi.pages.dev; deterministic
   days-since-epoch mod total-ayahs picker) → invalidate live query caches → update cached
   user → `syncAllTaskReminders` self-heal from local rows → outcome recording (failed if push
   failed or any change was rejected).
5. Retry policy `SYNC_RETRY`: 5 attempts, 5s→15s backoff, 15s per-request timeout
   (Render cold-start resilience). Full sync uses 20s timeouts.

### 8.3 Timer Tasks
`use-task-timer.ts`: timestamp math (`computeTaskTimerRemainingMs`, exported for reuse), state
persisted per (taskId,date,subTaskId) in AsyncStorage, in-session shared `dispatched` guard +
persisted `completionDispatched` flag ⇒ single dispatch ever. Dispatch order: mark first, then
mutate (kill-safety). Foreground tick + AppState resume + background-task wake all converge.
Running/completion notifications are silent (`data.type = 'timer-task'`), tapping one deep-links
(`/timer-task/[taskId]`) where mount reconciliation finalizes. A manual `complete()` converges on
the same path (no double-fire risk with a timer that hits zero simultaneously — same guard).

### 8.4 Notifications
Weekly local reminders per recurrence day (Expo weekday = 0-based+1 conversion), cancel-before-
reschedule, ID map in AsyncStorage; delete/logout cancels; each successful sync re-schedules
everything from fresh local data (self-heal). Android channel `task-reminders`; timer channels
separate.

### 8.5 Misc
- **Sub-task presentation in TaskCard** (added 2026-10-23, feature: paginated/collapsible
  sub-tasks): `components/task/sub-task-list.tsx` splits the sub-tasks it receives into
  incomplete (rendered, paginated **2 per page** via the existing `components/ui/pagination-bar`,
  shown only when >1 page; `page` state is clamped to the last page when the list shrinks) and
  completed (a collapsible **"Completed Sub-Tasks (N)"** section below, collapsed by default,
  expandable; rows render identically via an extracted module-level `SubTaskRow` — tapping a
  completed normal sub-task un-completes it, same toggle as before). This is presentation-only:
  parent status/reward aggregation still comes from ALL sub-tasks via
  `lib/db/tasks-repo.ts`'s `computeParentStatus`, and completion/increment handlers are unchanged.
- **Sub-task descriptions + expandable text** (added 2026-10-23): sub-tasks gained an optional
  `description` end-to-end — backend column/sync (see §5.4), mobile SQLite column + `migrations.ts`
  **version 2**, `sub-tasks-repo.ts` replace semantics (`undefined` keeps, `null`/"" clears),
  push builder always sends `description` (null included — server assigns directly), form input
  in `task-form.tsx` (always sent; emptied → null = clear), display in sub-task rows, task
  details inline, and the counter/timer pages' headers (`description = subTask?.description` for
  sub-task pages). Shared UI primitive: `components/ui/expandable-text.tsx` — collapses to
  `maxLines` when long, tap toggles; its wrapper Pressable is DISABLED while not truncated so
  taps fall through to outer Pressables (card details toggle, counter/timer row routing) —
  long titles on cards claim the tap for expand, with routing still available via the bottom
  links. Counter/timer page headers follow the details-page hierarchy: parent title on top,
  current title in the SAME size/weight, description below the current title. Web equivalents:
  see §7.
- **7-Day progress chart** (added 2026-10-23): `components/dashboard/task-progress-chart.tsx`
  on the home screen above DailyVerseCard — a `react-native-svg` (existing dep) two-line chart
  of fully-completed (solid, theme `success`) and partially-completed (dashed, theme `warning`)
  counts per day for the 7 days ENDING at the DateNavHeader's selected date. Data =
  `useTaskHistoryQuery(from, selectedDate)` → the local-first `deriveTasksForRange` read (no new
  fetching; works offline), which all mutations and sync pulls already invalidate via
  `['taskHistory']` — so the chart self-updates on every status change. Counting reuses the
  server-equivalent derived status per (task, date), so sub-tasks/recurring instances are never
  double-counted (a sub-tasked parent is one data point via `computeParentStatus`). Colors come
  from `useThemeColor` across all 10 themes; gridlines/labels use theme border/muted/tint.
- **UX/feature batch** (added 2026-10-24 — see each item's module/screen):
  - **Streaks**: `StreakChip` on Home (🔥 N-day, tap → Insights) computes current streak from
    `useTaskHistoryQuery` over 365 days via `lib/insights.ts` (own non-global tasks only; today
    not done ⇒ counts from yesterday). Milestones [3,7,14,30,60,100,180,365] fire a one-time
    Alert (shown-set in AsyncStorage `soulshield_shown_streak_milestones`).
  - **Insights** (`app/insights.tsx`, modal): 30/90-day completion rate, streaks, favorite
    category, best weekday from `computeInsightStats`; "Share Progress" snapshots the card via
    `react-native-view-shot` + `expo-sharing` (falls back to text Share).
  - **Search** (`app/search.tsx`): offline substring search over active personal tasks
    (`searchOwnTasksLocal`); tapping jumps Home to the task's next recurrence date (or opens its
    counter/timer page) via the `lib/jump-to-date.ts` one-shot store + `useFocusEffect` on Home.
  - **Heatmap jump**: History heatmap cells are Pressables → same jump store.
  - **Archived tasks** (`app/archived.tsx`): `is_active=false` tasks (set from the edit screen's
    Archive toggle) listed w/ Restore/Delete; listArchivedTasksLocal; reminders self-heal.
  - **Sync Issues UI** (`app/sync-notifications.tsx`): failed requests (existing) + **rejected
    changes** (`lib/background-sync/rejected.ts` store — fed by reconcilePushResults, previously
    console-warn only) + **conflicts** (`sync_conflicts` rows, server version wins; clearable).
  - **Logout guard**: Profile logout warns when `countPendingMutations() > 0` (explicit logout
    wipes the local store; auto-401 logout never does) and best-effort deletes the device's push
    token before `logout()`.
  - **Offline banner** on Home (`components/dashboard/offline-banner.tsx`, `useNetworkStatus`).
  - **Daily digest (#12)**: Profile → Notifications toggle + time (`lib/notification-prefs.ts`,
    `scheduleDailyDigest/cancelDailyDigest` in lib/notifications.ts; DAILY trigger, static copy —
     Additionally: Profile → Notifications has a **Send test notification**
  button (fire-and-forget ~3s scheduled notification) for verifying the pipeline; the Expo Go
  console warning "Android Push notifications (remote)… removed from Expo Go" is EXPECTED noise
  from expo-notifications' auto-registration at module load (harmless for LOCAL scheduled
  notifications — remote push itself genuinely requires the dev build).
  - **Onboarding** (`components/onboarding/onboarding-modal.tsx`): 3 slides, once per install
    (AsyncStorage flag `soulshield_onboarding_done_v1`), over the signed-in app.
  - **Export** (`lib/export.ts`): Profile → Data → "Export My Data (JSON)" — whole local store
    (incl. tombstones) to the OS share sheet (RN Share, no new deps).
  - **Haptics** (`lib/feedback.ts`): light impact on completion toggles/counter taps, success
    notification on reward modal + falling-confetti burst (Reanimated Keyframe, deterministic
    per-open seed).
  - **i18n scaffold** (`lib/i18n.ts` en+bn, `context/locale-context.tsx`, Profile language
    chips; `useLocale().t()` with EN fallback): tab labels, home header/statuses/banner/streak,
    chart, sub-task completed section, profile sections/tools/data labels, sync-issues, search/
    archived/insights screens, onboarding. Deeper surfaces (forms) still EN — add keys as
    translated.
  - **Android widget (#20)**: `lib/widget/task-widget.tsx` (react-native-android-widget v0.24,
    config plugin in app.json with `TaskOverviewWidget`): headless render from SQLite
    (today catio + next pending tasks, light/dark pair — headless = no React context); Home's
    `WidgetRefresher` pushes fresh renders on count/date changes. **Requires a native dev
    rebuild** (like expo-sqlite).
  - **Config fix (2026-10-24)**: `@react-native-community/datetimepicker` was removed from
    app.json's `plugins` — that package ships NO config plugin, so Expo aborted startup with
    "Unable to resolve a valid config plugin". The native module self-configures via autolinking
    in SDK 54 and never needed a `plugins` entry.
  - **Bundle fix (2026-10-24)**: `metro.config.js` carries a TEMPORARY resolver alias:
    `react-native/setup-env` → `react-native/Libraries/Core/InitializeCore`. Root cause: RN
    0.81.x's exports wildcard publishes `./setup-env.js` but the file doesn't exist in the
    official tarball, and `@expo/metro-runtime@6.1.2` (the latest stable, requested by
    expo-router ^6.1.2) hard-imports it — Expo's own fix (import InitializeCore instead, PRs
    #51177/#50863/#51536) is on the sdk-54 branch but unreleased. **Remove the alias once
    @expo/metro-runtime ships ≥ 6.1.3 stable**, then `npx expo start --clear`.
  - **Push registration (#19 client)**: Profile → "Cross-device sync alerts" toggle — permission
    + `getExpoPushTokenAsync({projectId from app.json extra.eas})` → POST /users/push-token;
    disable/logout DELETE it. Registered pushes arrive as data-only `type='data-change'` → catch-up
    sync (`lib/background-sync/data-change-task.ts`; iOS needs `enableBackgroundRemoteNotifications`,
    set in app.json).
- **Counter responsiveness + anti-revert** (fixed 2026-10-24, #counter-performance):
  - **Instant UI everywhere**: sub-task increments/toggles now optimistically patch the query
    caches (day list AND every cached `taskHistory` window) via the new
    `patchSubTaskInCaches`/`patchSubTaskIncrementInCaches`/`patchSubTaskToggleInCaches` in
    `lib/task-cache.ts`, recomputing the parent's derived status with the SAME exported
    `computeParentStatus` from `lib/db/tasks-repo.ts` — so the instant paint equals the next
    refetch (no flash-and-correct). Whole-task completion toggles
    (`useCompleteTask`) patch via `patchTaskStatusInCaches`; main-counter taps were already
    instant (increment buffer). Every patch first CANCELS in-flight list fetches for the touched
    windows (centralized in `patchTaskInCaches`) so a fetch started before the local write can't
    land stale data over the patch.
  - **Anti-revert guard against pulls**: a /sync pull whose snapshot predates pending local
    edits used to overwrite dirty local completion rows (progress reset = the reported "count
    appears to revert"). `lib/db/completions-repo.ts` now skips applying a pulled completion when
    the local row is dirty (syncedAt null) and the incoming row isn't strictly ahead (progress
    not higher AND not newly 'completed') — monotonic-progress rule, clock-skew-proof. The
    push-reconcile path passes `origin='push-reconcile'`: on an equal-or-ahead skip it clears
    `syncedAt` only (server provably has our delta), preserving prior reconcile semantics.
    Completion/push/sync architecture otherwise UNCHANGED (buffer, debounce, delta pushes).
- **Counter tap stall round 2** (fixed 2026-10-24, follow-up to #counter-performance): after
  the optimistic patches, taps STILL froze 1-2s because every `invalidateTaskLists` (i.e. every
  tap AND every push settle) re-derived the Streak chip's 365-day window via
  `deriveTasksForRange` on the JS thread. Fixes: (1) Streak chip moved to its OWN query key
  `['completedDates', from, to]` backed by the new lightweight
  `listOwnCompletedDatesInRange` (lib/db/tasks-repo.ts) — DISTINCT completed-dates rows incl.
  the sub-tasked-parent-derived rule — invalidated like the rest but now ~ms instead of a
  year-long task-loop; insights' big windows are only derived while that screen is mounted.
  (2) Sync PULLS batch all row upserts into ONE SQLite transaction
  (`withTransactionSync` in lib/background-sync/pull.ts; previously every row autocommitted →
  hundreds of fsyncs froze the JS thread exactly when the user starts tapping after opening
  the app). On a batch failure it falls back to per-row best-effort; the cursor advances only
  after all rows land (idempotent re-pull ✓).
- **Reward text in edit forms** (fixed 2026-10-24): list endpoints gated `reward_text` to
  completed tasks only, so the edit form never received the configured reward. Now surfaced
  whenever configured in ALL list paths (backend `repo/task.go` ×3 + `subtask_merge.go` ×2;
  mobile derive mirrors it) — display keeps gating on status client-side (reward banner/modal
  show only when completed; web's upcoming-reward preview now actually works pre-completion).
  Mobile edit screen additionally falls back to the raw local row (`getTaskByUuid`) for stale
  cached lists.
- **ESP32 Bluetooth counter control** (added 2026-10-30, #esp32-bluetooth):
  - **Firmware**: `Framework/` (PlatformIO, ESP32-C3, Arduino BLE) + a second variant
    `Framework-ESP32-DevModule/` for the classic ESP32/WROOM "ESP32 Dev Module" board
    (identical BLE identity/behavior; status LED on GPIO2 instead of GPIO8 — the app pairs
    with either board the same way). GPIO4 button (pull-up, 50ms
    debounce) → one "1" notification per press on `a1b2c3d4-...` under service
    `9f83f3d0-8f5f-4a3f-9a1d-2c6a8f4e5b01`; device name `SoulShield-ESP32`; always advertising
    when disconnected; LED mirrors connection. See Framework/README.md (wiring, flash).
  - **App**: `react-native-ble-plx@3.5.0` (+ its bundled config plugin in app.json — BG mode
    simple: no foreground service; `neverForLocation`). Headless manager
    `lib/bluetooth/counter-ble.ts`: scan (filtered by service UUID, Android 12+ runtime
    permissions) → connect ({autoConnect:true}) → monitor TX → each press dispatches the SAME
    +1 path as manual taps (local SQLite increment → optimistic cache patch via
    patchTaskInCaches/patchSubTaskIncrementInCaches → background additive push via the module
    mutation fns) — full background support while the app process is alive (no OS kill).
  - ⚠ **Does NOT run in Expo Go** — the BLE native module only exists in a dev build
    (`npx expo run:android`); the app surfaces this explicitly in the connect modal
    (`ble.expoGo` / BLE_ERROR_EXPO_GO sentinel) instead of failing silently.
  - **One ACTIVE task at a time**: `ActiveCounterTask {taskId, subTaskId|null}` persisted
    (AsyncStorage) + auto-reconnect on launch (paired device re-connects silently). Connect UX:
    counter page header Bluetooth icon (success = connected+controlling THIS task; tint =
    scanning/connecting; muted = off) opens `components/counter/ble-connect-modal.tsx` —
    picker list (RSSI-sorted) → connect → switches active task; connected-state shows
    Disconnect; when already connected to device but different task, one-tap
    "Control this task" switch (no reconnect needed).
- 401 anywhere → global handler → logout(**keepLocalData** — offline edits survive; re-login as
  same user pushes them). Explicit logout (Profile) wipes SQLite + reminders.
- **Local data ownership (2026-11-18, B1)**: the store has no per-row owner, so `lib/local-owner.ts`
  records which user id the on-device data belongs to (AsyncStorage `soulshield_local_owner_user_id`).
  `login()` calls `prepareLocalDataForUser(me.id)` BEFORE storing the new token: same user → keep
  (offline edits survive a 401 re-login); different user, or unknown owner with data present →
  `wipeAccountLocalData` (SQLite incl. sync cursor + conflicts, query cache + persisted copy incl.
  paused mutations, reminders, rejected-changes list, BLE active task, user-scoped AsyncStorage keys
  such as pending increments / timer-task state / push registration). Explicit logout and account
  deletion use the same wipe. Pure rule in `lib/local-owner-decision.ts` (unit-tested).
  Signed-in users from before this change get their id recorded on next launch
  (`ensureLocalOwnerRecorded`). **When adding new per-user AsyncStorage keys, add them to
  `USER_SCOPED_KEYS`/`USER_SCOPED_PREFIXES` in `lib/local-owner.ts`.**
- Account screens: `app/account/change-password.tsx`, `app/account/delete-account.tsx` (modal
  stack, linked from Profile → Account). Web: `ChangePasswordModal.jsx` (fixed, now uses
  `/users/change-password`), `DeleteAccountModal.jsx` (password + type DELETE).
- Dev diagnostics: Profile → contract check (`checkDerivedTasksAgainstServer`) comparing on-device
  derivation vs `GET /tasks` per date — no test framework exists; this is the drift alarm for the
  TS port of the Go derivation logic.
- `PERSIST_BUSTER` history: v1→v2 (local-first cutover), v2→v3 (increment variables shape change).
  Both bumps deliberately discarded stale persisted state.

---

## 9. Cross-client API contract notes (id semantics!) ✅

- List/read endpoints return **both** numeric ids and uuids: `task_id` (int) + `task_uuid`
  (string), `sub_task_id` + `sub_task_uuid`, `category_id` + `category_uuid` (+ name/color).
  **Web reads the numeric fields; mobile reads the uuid fields** (the mobile `Task` type reuses
  the names `task_id`/`category_id` to carry uuid strings — checked `deriveTasksForRange`).
- The mobile never learns numeric ids; the server resolves uuid → id server-side on sync push.
- Status vocabulary: `pending | completed | missed | partially_completed(derived, read-only)`.
- Recurrence day ints 0=Sun..6=Sat on the wire.
- Push payload field names mirror the pull shapes one-for-one so a pulled row can be round-
  tripped back as a push (`sync-push-builders.ts` ↔ `repo/sync.go`).

---

## 10. Critical execution flows (traced end-to-end) ✅

1. **Web complete checkbox**: TaskCard → `completeTask(taskId, fmtDate)` → `POST /tasks/{id}/complete`
   → repo upsert → CompletionResponse (+reward) → local patch → RewardModal.
2. **Web counter tap**: CounterWidget → `useCounter.increment` → local bump; 3s debounce →
   `POST /tasks/{id}/increment {amount}` → additive update + one-way auto-complete.
3. **Mobile complete (offline)**: TaskCard → `useCompleteTask.mutate` → SQLite toggle +
   invalidate → mutation paused & persisted → reconnect: replay → `POST /sync` upsert →
   `reconcilePushResults` marks synced → background pull may follow.
4. **Mobile counter tap (online or off)**: tap → SQLite increment + cache patch → debounce →
   `POST /sync` increment delta → server sums (application-level merge, not LWW).
5. **Mobile sub-task increment**: `useIncrementSubTask.mutate` → SQLite increment immediately →
   push increment → parent status recomputed locally from derived tasks (`findDerivedTask`).
6. **Timer Task finishes while phone is locked**: notification fires (scheduled at start);
   background task wake → `checkAndCompleteFinishedTaskTimers` → idempotent local complete →
   push → app reopen reconciles.
7. **Fresh device**: login → full pull (`since` empty) → SQLite populated → reminders scheduled →
   every screen reads locally.
8. **Task deleted on web**: REST soft delete → next mobile pull receives tombstone → local
   soft delete + conflict check (only flags if local row was dirty).
9. **Register (web)**: `registerUser(full_name,email,password,answer)` → bcrypt both → user +
   reset otp flag → auto-login via `/users/login` → JWT.
10. **Password reset (web & mobile)**: verify answer (lockout after 5) → 15-min reset JWT →
    reset-password → `email_otps.verified=false` (vestigial). Existing JWTs remain valid.

---

## 11. Critical files & change-caution map ✅

**Cross-cutting invariants (break these and sync breaks):**
- `soul-shield/repo/sync.go` + `repo/sync_push.go` ↔ `soul-shield-mobile-app/api/sync-types.ts` +
  `lib/db/sync-push-builders.ts` — every field added/renamed must move on **both** sides.
- `soul-shield/rest/handlers/task/subtask_merge.go` (`computeParentStatus`) ↔
  `soul-shield-mobile-app/lib/db/parent-status.ts` (`computeParentStatus`, re-exported by tasks-repo.ts;
  both tested against `shared-test-fixtures/parent-status.json` — add a case there when the rule changes) — duplicated derivation
  logic; mobile has `contract-check.ts` as the drift detector. Use it after touching either.
- Backend `migrations/000001_*.sql` — append-only. Mobile `lib/db/migrations.ts` — append-only,
  tied to `PRAGMA user_version`.
- `lib/persister.ts` `PERSIST_BUSTER` — bump on any change to persisted query/mutation shapes.
- `lib/mutation-defaults.ts` — mutationFn variable shapes are persisted; a shape change without
  a buster bump silently no-ops replayed mutations.
- `util/errors.go` sentinel errors are matched with `switch err { case ... }` (reference
  equality) in handlers — adding wrapped errors needs care (`errors.Is` used only in some paths).
- DB CHECK constraints (`chk_task_type_fields`, `chk_task_owner`, recurrence array, reminder
  regex) — repo + handler + sync-push all assume them; syncing writes bypass handler validation
  and rely on these CHECKs + class-23 rejection mapping.
- Sync push ordering assumptions: parents before children; mobile pushes before pulling;
  `task_completions` UNIQUE(task,user,date) merge assumption (`dropMergedLocalCompletions`).
- **Sub-task description write semantics** (added 2026-10-23, updated same day when web gained
  the feature): all server write paths (REST ReplaceForParent update branch AND sync
  `pushSubTask`) assign `description` directly — full-row semantics, null clears. Local reorder
  flows on mobile omit the field (`undefined` keeps the stored value). Changing these without
  each other will either wipe descriptions on reorder-style edits or strand cleared ones — see
  §5.4's sub-task bullet before touching `ReplaceForParent`, `pushSubTask`,
  `replaceSubTasksForParentLocal`, either task form, or the push builder.

**High-traffic files most future features will touch**: `rest/handlers/task/*` + `repo/task.go`
(backend), `lib/db/tasks-repo.ts` + `hooks/queries/use-task-mutations.ts` + `lib/
mutation-defaults.ts` (mobile), `src/pages/Dashboard.jsx` + `components/TaskCard.jsx` +
`TaskFormModal.jsx` (web).

---

## 12. Verified issues, risks & observations (all confirmed in code)

**Confirmed functional bug**
1. ~~**Web "Change Password" modal is broken**~~ **FIXED 2026-11-18** (new `/users/change-password`). (`src/components/ChangePasswordModal.jsx`):
   `handleReset` calls `resetPassword(user.email, password)`, but the backend expects
   `{reset_token, new_password}` where `reset_token` is the JWT from `/users/verify-security-answer`.
   An email is never a valid token ⇒ this modal always fails with 401 "Invalid or expired reset
   session". The OTP step it used to have is commented out and was never replaced with the
   security-answer step. (The ForgotPassword *page* implements the flow correctly.)

**Latent / dead code**
2. `AuthContext.register(full_name, email, password)` drops `security_answer` — would always
   400 — but is dead code (Register.jsx calls `registerUser` from ApiContext directly with all
   4 args).
3. ~~`rest/handlers/opt`~~ **REMOVED 2026-11-18.** (Was:) `/send-otp`, `/verify-otp` are unauthenticated, still live, and
   vestigial: registration no longer requires email verification (checks commented out); still
   sends SMTP mail if invoked. OTP endpoints answer with plain-text errors (client.ts has a
   fallback for this).
4. `middlewares/require_role.go` `RequireRole` — never used.
5. `infra/db` `NewConnectionOffline`, `config.DB` — built but unused (Neon URL path only).
6. Web `App.jsx` registers two `*` routes; the first (`Navigate to="/-"`-style redirect) wins on
   matches, so `NotFound` is unreachable.

**API/behavioral quirks**
7. ~~`POST /users/login`: wrong password returns **400** with message "Internal Server Error"
   (repo `Find` returns `(nil, nil)` on bcrypt mismatch); success returns 201 (not 200).~~
   **FIXED 2026-10-24** — now 401 "Incorrect email or password" (`util.ErrInvalidCredentials`)
   and 200 on success (see §5 route notes).
8. `GET /users/me` re-parses the Authorization header (duplicates middleware; ignores the
   verified context values).
9. REST `POST /tasks/{id}/complete` cannot un-complete (upsert only sets 'completed'). Web users
   therefore can never un-complete; mobile can (sync upsert honors any status).
10. Nothing server-side blocks completing a **sub-tasked parent** via REST complete (client UX
    only); the row would be stored but reads always override with derived status.
11. "Read-only past/future days" is **client-enforced only** — the API accepts any
    recurrence-scheduled date (verification of README claim).
12. Status defaults (`missed` vs `pending` boundary) use the **server's local clock** (UTC on
    Render) while mobile uses the device-local date → near midnight the two clients can disagree
    (e.g. yesterday's tasks briefly still "pending" on web).
13. `pushTask` sync upsert defaults `is_active=true` when the field is omitted (current clients
    always send it; a future thinner payload would silently reactivate archived tasks).
14. Web AdminTasks "usage" stats (`useAdminTasks`) are computed from the **admin's own** 30-day
    history; "unique users" are actually unique dates — misleading numbers, commented in code.
15. Category delete (REST and sync) nulls `category_id` on **all** tasks referencing it, without
    owner scoping in SQL — safe in practice (only admins create global tasks), but an edge if a
    global task ever referenced a user-owned category.
16. `Log` middleware doesn't log status codes; no request panic-recovery middleware beyond
    net/http defaults.

**Security considerations (documented, not "fixed" — no changes made yet)**
17. CORS `Access-Control-Allow-Origin: *` with `Authorization` allowed (tokens, not cookies ⇒
    no CSRF; but any origin can call the API).
18. ~~JWTs live 30 days and are not invalidated on password change/reset~~ **FIXED 2026-11-18**
    (`token_version`, 14-day sliding sessions; see §5.2).
19. ~~No rate limiting on login/register~~ **FIXED 2026-11-18** (see §5.3 auth hardening).
20. `util.ClientIP` trusts the first `X-Forwarded-For` hop blindly (audit log only).
21. Web stores the JWT in `localStorage` (XSS exposure); mobile uses SecureStore.
22. `email_otps.otp` bcrypt-hashed (good) but the OTP flow itself is dormant.

**Operational**
23. Backend has no graceful shutdown; `ListenAndServe` + `os.Exit(1)` on error.
24. ~~No tests anywhere~~ — **2026-11-18**: first Go + mobile unit tests and GitHub Actions CI
    (`.github/workflows/ci.yml`). Coverage is still thin (no DB-backed repo/sync tests yet); web lint
    is non-blocking in CI until its pre-existing errors are fixed.
25. Render free-tier cold start is expected; the mobile retry policy (5 attempts, ≤15s backoff)
    and the `isRetryableError` set (0/502/503/504) are tuned for it — keep in sync.
26. `docs/` Swagger is generated; if handlers change, regenerate (`swag`) or docs drift.

---

## 13. Remaining analysis gaps (read at lower depth, not line-by-line)

Verified at the level of API usage/import graph, structure and call sites, but not every line:

- **Web pages**: `History.jsx`, `Profile.jsx`, `AdminTasks.jsx`, `TaskTimer.jsx`,
  `CategoryDetail.jsx`, `ForgotPassword.jsx`, `Login.jsx` (API touchpoints + structure known);
  presentational components (`Heatmap`, `DayGroup`, `DateRangePicker`, `WeeklyStats`,
  `LeaderboardPreview` (placeholder), `OnboardingTooltip`, `Sidebar`, `MobileBottomNav`,
  `Toast`, `ui/*`).
- **Mobile screens**: `app/(tabs)/*` page JSX, `components/task/task-form.tsx` and other form/
  modal components, `counter/*`, `timer/*` (standalone focus timer internals), `filters/*`,
  `reorder/*`, `history/heatmap.tsx`; `api/types.ts` & `sync-types.ts` full shape lists
  (understood via usage); `lib/timer/*`, `use-task-reminders-sync.ts`,
  `lib/background-sync/validate.ts`, `api/quran-*.ts`, `lib/arabic.ts`, `task-cache.ts`.
- **Backend**: `docs/` (generated), `static/` assets, `.claude/` tooling folders.
- Nothing outside the three sub-projects was accessed; no secrets were read or recorded.
  The backend `.env` was only inspected for variable *names*.

**Priority follow-ups if relevant to a future task**: read the mobile task-form and
(tabs) screens before touching form/UX flows; regenerate Swagger after backend handler
changes; add tests (none exist); decide fate of the OTP/`opt` package and the broken
ChangePasswordModal.

## 14. 2026-11-18 Medium-priority pass (see PROJECT_ANALYSIS.md §12)

- **Timezone:** `util/clock.go`: `X-Timezone` (IANA) → `RequestToday(r)`; read endpoints default
  to the user's today; write endpoints reject dates after `RequestLatestDate(r)` (UTC+14 bound
  without the header). Repos take an explicit `asOf` date instead of `CURRENT_DATE`.
- **New endpoints:** `GET /healthz`, `GET /tasks/stats`, `POST /tasks/{id}/uncomplete`,
  `POST /tasks/{taskId}/subtasks/{subTaskId}/uncomplete`, `GET /admin/stats` (admin only).
- **Rules on the server:** tasks with sub-tasks can't be completed directly; increments only on
  counters; no future dates (REST and `/sync`). Task create/update with sub-tasks is one
  transaction (`CreateWithSubTasks` / `UpdateWithSubTasks`).
- **Sync push:** one transaction per batch, uuid prefetch, savepoints only when the fast path
  hits a rejectable error; ≤ 500 changes per request (413). Conflicts use `base_updated_at`
  when sent (mobile SQLite v3 `server_updated_at`), else client time capped at server time.
  Pull cursor is capped at the oldest open transaction's start so in-flight pushes aren't skipped.
- **Ops:** slog JSON logs with `X-Request-ID`, panic recovery, 1 MiB body limit, http.Server
  timeouts. DB integration tests: `repo/integration_test.go` (needs `TEST_DATABASE_URL`, CI runs
  Postgres 16).
- **Web:** session-expired redirect, cold-start banner, strict CSP (`vercel.json`: update
  `connect-src` if the API origin changes), shared form validation, lint is blocking in CI,
  admin page uses real stats (mock leaderboard removed).
- **Mobile:** sends `X-Timezone`, adopts `X-Refreshed-Token` (`api/client.ts` →
  `onRefreshedToken`), change-password stores the returned token, pushes chunked at 200.

---

*Created by the 2026-10-23 full-repository analysis (backend ~45 Go files, web ~55 JSX files,
mobile ~130 TS files read directly, plus config/schema/migrations). Update this document with
any future change — especially the invariants in §11.*

## 15. 2026-11-18 Low-priority pass (see PROJECT_ANALYSIS.md)

Backend:
- **Removed** the Quran API (B20) and the leftover OTP/mail code + gomail; tables kept.
- **Config** (C6): only `SECRETKEY`/`CONN_STRING_FOR_DB` required; `CORS_ORIGINS` allow-list (S7,
  `middlewares.Cors`, exposes `X-Refreshed-Token`/`Retry-After`/`X-Request-ID`); graceful shutdown;
  `infra/db` logs via slog.
- **Context keys** (C6): `middlewares.WithUser` / `UserID(r)` / `Role(r)` with a private key type
  replace the string keys and the per-package `getUserID` helpers.
- **Input errors** (B10): title (≤255 runes) / category name (≤100) / recurrence type validated in
  handlers; remaining SQLSTATE 22xxx/23xxx (non-unique) map to `util.ErrInvalidInput` → 400.
  Category rename onto an existing name → 409. Handlers use `errors.Is`.
- **Push** (B14/B17): category create/update/delete/reorder and task reorder now send the
  data-change push; tokens are sent in batches of 100 and `DeviceNotRegistered` tokens deleted.
  Push token format validated (`ExponentPushToken[...]`); a token registered to another account is
  deliberately reassigned (S10c, documented on `UpsertToken`).
- **ClientIP** (S10a): `TRUSTED_PROXY_HOPS`; default unchanged until Render's header layout is
  verified on a deployed request.
- **Security-answer lockout** per email+IP (S10b, see §5).
- Tests: cors, ParseOrigins, validateTitle/RecurrenceType, push-token pattern, Expo ticket parsing,
  ClientIP, + integration tests for the per-IP lockout and category rename conflict.

Web: single `*` → NotFound route (B12); unused `register` removed (B13); counter taps flushed with
`fetch(..., { keepalive: true })` on tab hide / `pagehide` (B15); admin row checkbox labelled (U9).
Every page already had a loading skeleton (U10).

Mobile: `api/client.ts` message fallback uses `||` (B18); `clearLocalDatabase` runs in one
transaction; the overnight sync window uses device-local time instead of Asia/Dhaka (stored key
`lastSuccessDhakaDate` keeps its name) (C8); `TextField` has a password show/hide toggle + `hint`
(rules shown on register / reset / change password) (U6); 31 icon-only buttons got
`accessibilityRole`/`accessibilityLabel` (checkboxes report checked state) (U9).

Deferred: features F6/F7/F9–F14, U7 (i18n), U8 (conflict UI), U11, S10d (BLE pairing auth), S10e (needs email reset F1), B22
(metro alias waits on an upstream release), C8 large-file splits, PERSIST_BUSTER snapshot test.
