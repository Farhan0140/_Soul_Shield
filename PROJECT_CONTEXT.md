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
| `repo/` | Data access layer, one file per aggregate (see §5) |
| `rest/server.go` | Global middleware chain + `http.ServeMux` registration + Swagger route + ListenAndServe (port = env `PORT` → fallback `HTTPPORT`) |
| `rest/middlewares/` | `Manager` (compose chain), `Preflight`, `Cors`, `Logger`, `AuthenticateJWT`, `RequireRole` (⚠ defined but never used), `middleware.go` (struct) |
| `rest/handlers/user/` | register / login / verify-security-answer / reset-password / me |
| `rest/handlers/opt/` | ⚠ package name is a typo of "otp": `POST /send-otp`, `POST /verify-otp` (unauthenticated, vestigial — see §12) |
| `rest/handlers/task/` | 14 files: routes, create/update/delete, list (date), history, list-by-category (paginated), mine (flat), reorder, complete, increment, sub-task complete/increment, sub-task merge/derive, add-to-my-tasks (id + by-uuid), mapper, dto |
| `rest/handlers/category/` | CRUD + reorder |
| `rest/handlers/quran/` | last-read upsert/get, bookmarks CRUD (not in README) |
| `rest/handlers/sync/` | pull/push handlers + DTO passthrough |
| `util/` | `jwt.go` (auth 30-day JWT + scoped 15-min reset JWT), `errors.go` (sentinel errors), `send_data.go` (JSON writers), `constants.go` (recurrence/status consts), `mail.go` (gomail OTP email), `otp.go` (crypto-random 6-digit), `request.go` (ClientIP for audit logs) |
| `docs/` | **Generated** Swagger spec (swaggo) — don't hand-edit |
| `.env` | Real config, present locally (values NOT recorded anywhere in analysis) |
| `.env.example` | Template: `VERSION, SERVICENAME, HTTPPORT, SECRETKEY, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_ENABLE_SSL_MODE, CONN_STRING_FOR_DB, SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD` |

### Web — `soul-shield-client/`
| Path | Purpose |
|---|---|
| `vite.config.js` | react + tailwindcss plugins, nothing custom |
| `vercel.json` | SPA rewrite `/.* → /index.html` |
| `src/main.jsx` | Provider tree: BrowserRouter → ThemeProvider → ApiProvider → AuthProvider → ToastProvider → LazyMotion/MotionConfig → App |
| `src/App.jsx` | Route table (⚠ duplicate catch-all, see §12) |
| `src/services/api.js` | Fetch wrapper: base `VITE_API_URL` (default localhost:3000), token from `localStorage['soulshield_token']`, 15s timeout, error humanization maps |
| `src/context/` | `ApiContext.jsx` (all endpoint wrappers), `AuthContext.jsx` (session), `ThemeContext.jsx` + `themes.js` (10 themes via `data-theme`) |
| `src/hooks/` | `useTasks` (day list + date nav), `useCounter` (debounced counter batching), `useTimerTask` (web timer, localStorage), `useHistory`, `useAdminTasks`, `usePersonalStats` |
| `src/pages/` | Dashboard, History, Categories, CategoryDetail, Profile, AdminTasks, TaskTimer, Login/Register/ForgotPassword/AuthLayout, NotFound |
| `src/components/` | TaskCard, TaskFormModal (create/edit + sub-tasks incl. descriptions), SubTaskList (paginated + collapsible completed section), ExpandableText, CounterWidget, RewardModal, CategoryRow/Card/FormModal, ProgressSummary, Heatmap, ChangePasswordModal, ConfirmModal, Toast, Sidebar/MobileBottomNav/AppLayout, ui/Button+Input |
| `dist/` | Built output (committed in tree; not source) |

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
| UI extras | swaggo/http-swagger docs; gomail (SMTP) | Tailwind CSS 4 (`@tailwindcss/vite`), Framer Motion, lucide-react | Reanimated 4, expo-notifications (local only), expo-background-task/WorkManager, netinfo, haptics, svg, reanimated-worklets |
| Tests | none | none | none (dev-only `contract-check.ts` diagnostic) |

---

## 4. Configuration & environment ✅

**Backend required env** (validated at startup, process exits if missing):
`VERSION, SERVICENAME, HTTPPORT, SECRETKEY, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
DB_ENABLE_SSL_MODE (bool), CONN_STRING_FOR_DB` + optional `SMTP_*`. `.env` loaded only when
`ENV != "production"`. Runtime listen port: env `PORT` (Render) → fallback `HTTPPORT`.
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
(user, otp, task, subTask, category, quran, sync) → handlers (user takes cnf+repos+middlewares;
task takes task+subTask+category repos) → `rest.NewServer(...).Start()`.

### 5.2 Auth & security model
- JWT HS256, **30-day expiry** (commit 43b386d). Claims: `ID, Full_Name, Email, Role` +
  registered claims. Header scheme is `Authorization: JWT <token>` (not Bearer).
- `AuthenticateJWT` middleware puts `userID` (int64) and `role` (string) into request context.
- `RequireRole` middleware: **defined, never used** (dead code). Instead each handler checks
  role where needed (`CreateTask` rejects non-admin `is_global`; `checkOwnership` in repo allows
  admin to edit/delete anything).
- Passwords & security answers & OTPs are bcrypt-hashed (`DefaultCost`). OTP stored bcrypt-hashed
  with 5-minute expiry in `email_otps` (unique email, upsert).
- **Password reset flow**: `POST /users/verify-security-answer` → `userRepo.VerifySecurityAnswer`
  (5 failed attempts → 24h `security_answer_locked_until`; every attempt logged to
  `security_answer_attempt_logs` with IP via `util.ClientIP` which trusts `X-Forwarded-For`;
  deliberately generic error messages to prevent enumeration) → returns 15-min
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
`POST /users/verify-security-answer`, `POST /users/reset-password`, `POST /send-otp`,
`POST /verify-otp` (opt handlers do their own method checks and respond with plain text errors).
Global (all routes): Preflight → Cors → Logger. Swagger: `/swagger/`.

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
| `GET/PUT /quran/last-read` | per-user single row upsert |
| `GET/POST /quran/bookmarks`, `PATCH/DELETE /quran/bookmarks/{id}` | unique per (owner,surah,ayah) → 409 on dup |
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
- **Soft delete everywhere** (except quran bookmarks, which hard-delete): tasks cascade
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
- `email_otps` (unique email, bcrypt otp, `verified` flag — currently unused by flows)
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
- `quran_last_read` (PK user_id), `quran_bookmarks` (UNIQUE owner+verse, note) — **not part of
  the sync protocol**; bookmarks hard-delete

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
- **Auth pages**: Register (2-step email→account; OTP UI commented out; calls `registerUser`
  with all 4 args directly), ForgotPassword (verifySecurityAnswer → resetPassword two-step).

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
  current title in the SAME size/weight, description below the current title.
- 401 anywhere → global handler → logout(**keepLocalData** — offline edits survive; re-login as
  same user pushes them). Explicit logout (Profile) wipes SQLite + reminders.
- `clearLocalDatabase` also runs at sign-out because the store is **not user-scoped**.
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
  `soul-shield-mobile-app/lib/db/tasks-repo.ts` (`computeParentStatus`) — duplicated derivation
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
1. **Web "Change Password" modal is broken** (`src/components/ChangePasswordModal.jsx`):
   `handleReset` calls `resetPassword(user.email, password)`, but the backend expects
   `{reset_token, new_password}` where `reset_token` is the JWT from `/users/verify-security-answer`.
   An email is never a valid token ⇒ this modal always fails with 401 "Invalid or expired reset
   session". The OTP step it used to have is commented out and was never replaced with the
   security-answer step. (The ForgotPassword *page* implements the flow correctly.)

**Latent / dead code**
2. `AuthContext.register(full_name, email, password)` drops `security_answer` — would always
   400 — but is dead code (Register.jsx calls `registerUser` from ApiContext directly with all
   4 args).
3. `rest/handlers/opt` (`/send-otp`, `/verify-otp`) are unauthenticated, still live, and
   vestigial: registration no longer requires email verification (checks commented out); still
   sends SMTP mail if invoked. OTP endpoints answer with plain-text errors (client.ts has a
   fallback for this).
4. `middlewares/require_role.go` `RequireRole` — never used.
5. `infra/db` `NewConnectionOffline`, `config.DB` — built but unused (Neon URL path only).
6. Web `App.jsx` registers two `*` routes; the first (`Navigate to="/-"`-style redirect) wins on
   matches, so `NotFound` is unreachable.

**API/behavioral quirks**
7. `POST /users/login`: wrong password returns **400** with message "Internal Server Error"
   (repo `Find` returns `(nil, nil)` on bcrypt mismatch); success returns 201 (not 200).
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
18. JWTs live 30 days and are **not invalidated** on password change/reset — a stolen token
    survives a password reset.
19. No rate limiting on login/register (only the security-answer lockout + attempt logs exist).
20. `util.ClientIP` trusts the first `X-Forwarded-For` hop blindly (audit log only).
21. Web stores the JWT in `localStorage` (XSS exposure); mobile uses SecureStore.
22. `email_otps.otp` bcrypt-hashed (good) but the OTP flow itself is dormant.

**Operational**
23. Backend has no graceful shutdown; `ListenAndServe` + `os.Exit(1)` on error.
24. No tests anywhere in the monorepo; mobile relies on the dev-only contract check.
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

---

*Created by the 2026-10-23 full-repository analysis (backend ~45 Go files, web ~55 JSX files,
mobile ~130 TS files read directly, plus config/schema/migrations). Update this document with
any future change — especially the invariants in §11.*
