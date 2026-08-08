# Open Agent Studio

An open-source visual AI Agent Builder — design, test, connect tools, configure models,
and deploy AI agents as hosted API endpoints.

**Status:** this is a working full-stack scaffold with real auth, a real database schema,
a real streaming execution engine, and production-hardening (SSRF protection, rate limiting,
encrypted secrets, agent-scoped API keys). It is **not** a finished, audited commercial
product — see "Known limitations" before putting it in front of untrusted users.

## What's implemented vs. what's a stub

**Fully implemented:**
- Email/password auth (bcrypt + signed JWT session cookie) and Google OAuth (with CSRF
  state validation and `email_verified` enforcement)
- Visual agent builder on a real `@xyflow/react` canvas, saved via a validated,
  size-limited API
- Streaming execution engine (SSE) with real provider usage-based token accounting,
  a wall-clock deadline, a max-step guard, and client-disconnect (AbortSignal) handling
- Model provider keys and MCP server auth headers encrypted at rest (AES-256-GCM), never
  returned to the browser
- Agent-scoped and account-wide API keys (SHA-256 hashed, shown once)
- A public, slug-based deployment endpoint (`/api/deploy/{slug}/run`), separate from the
  internal session-authed test endpoint (`/api/agents/{id}/run`)
- SSRF-hardened outbound requests (HTTP Request tool, Custom API tool, MCP client) —
  blocks localhost/private/link-local/cloud-metadata targets, resolves DNS itself to catch
  rebinding, validates redirects, enforces timeouts and response-size caps
- Redis-backed rate limiting on login, registration, agent execution, API key creation,
  and MCP connection testing

**Explicitly stubbed / disabled — do not treat as production-ready:**
- **Code Execution tool** — always throws. Vercel's serverless runtime is not an isolated
  sandbox; do not wire this up without a real microVM/sandbox service.
- **Database Query tool** and **Email tool** — throw until you wire in a real datasource
  connector / email provider.
- **Tool enable/disable (Tools page)** — currently a *global* toggle shared by every user of
  the deployment, not per-user. Fine for a single-tenant/self-hosted install; needs a
  per-user junction table before this app is truly multi-tenant.
- **Memory** — the Memory config page persists settings, but the runner does not yet
  actually perform vector retrieval or cross-session persistence; `memory`/`database` graph
  nodes are pass-through no-ops.
- **Human Approval node** — pauses the run (`WAITING_APPROVAL`) but there is no resume
  endpoint/UI yet; treat it as "stop and inspect," not "pause and continue."

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · `@xyflow/react` · PostgreSQL · Prisma ·
Redis (`ioredis`) · Zod · `jose` (JWT) · `bcryptjs`

## Folder structure

```
src/
  app/
    (auth)/login, (auth)/register        Auth pages
    (dashboard)/...                      Protected app pages
    api/
      agents/[id]/run                    Internal test-run endpoint (session or API key)
      deploy/[slug]/run                  Public production endpoint (API key required)
      ...                                Full REST API — see route.ts files
    page.tsx                             Public landing page
  components/
    builder/                             React Flow node, config panel, node metadata
    ui/                                  Small design-system primitives
  lib/
    models/                              Model abstraction layer (OpenAI/Anthropic/Gemini)
    tools/                               Built-in tool registry (SSRF-hardened)
    mcp/                                 MCP JSON-RPC client (SSRF-hardened)
    security/safe-fetch.ts               Shared SSRF-hardened fetch wrapper
    agent-runner/
      engine.ts                          Graph execution engine (deadline, step limit, abort)
      run-request.ts                     Shared SSE streaming + persistence for both run routes
      validate.ts                        Server-side agent graph validation
    rate-limit.ts                        Redis-backed rate limiter
    auth/                                Password hashing + JWT session + OAuth helpers
    prisma.ts, redis.ts, crypto.ts       Infra clients + AES-256-GCM secret encryption
  middleware.ts                          Route protection
prisma/
  schema.prisma                          Full data model
  migrations/                            Versioned SQL migrations (see below)
  seed.ts                                Demo user + demo agents
docker-compose.yml                       Local Postgres + Redis
vercel.json                              Explicit Vercel build/install command
```

## Installation

Requires Node.js 20+.

```bash
npm install     # runs `prisma generate` automatically via postinstall
cp .env.example .env
```

Fill in `.env` — at minimum `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, and
`ENCRYPTION_SECRET` (generate secrets with `openssl rand -base64 32`).

## Database setup

Start Postgres + Redis locally with Docker:

```bash
docker compose up -d
```

Or point `DATABASE_URL` / `REDIS_URL` at your own instances (e.g. Supabase/Neon + Upstash).

Apply the migration (creates all 13 tables: User, Project, Agent, AgentNode, AgentEdge, Tool,
MCPServer, ModelProvider, Memory, Deployment, APIKey, AgentRun, ExecutionLog):

```bash
npm run prisma:migrate      # local dev — applies prisma/migrations, creates new ones as you edit schema.prisma
# or, for an already-versioned migration history (production-style):
npm run prisma:deploy       # applies existing prisma/migrations/*, does not generate new ones
```

Optionally seed demo data:

```bash
npm run db:seed
```

Creates `demo@openagentstudio.dev` / `password123` with three example agents.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **yes** | Postgres connection string |
| `REDIS_URL` | **yes** | Backs rate limiting (login/register/run/API-key-create/MCP-test). App still boots without it, but rate limiting fails open — don't run production traffic that way. |
| `AUTH_SECRET` | **yes** | Signs session JWTs |
| `ENCRYPTION_SECRET` | **yes** | Encrypts model provider keys + MCP auth headers at rest |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | no | Enables "Continue with Google" |
| `SEARCH_API_KEY` | no | Enables the built-in Web Search tool (Bing Web Search API) |
| `NEXT_PUBLIC_APP_URL` | no | Used to build deployment endpoint URLs shown in the UI |

Model provider API keys (Anthropic/OpenAI/Gemini) are **not** env vars — add them per-account
from the in-app **Models** page. They're AES-256-GCM encrypted with `ENCRYPTION_SECRET`
before being written to Postgres and are never sent back to the browser (only a short,
non-secret prefix like `sk-ant-••••` is shown for UI recognition).

## Local development

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Production build

```bash
npm ci
npm run prisma:generate
npm run build
```

`npm run build` runs `next build` directly (for platforms/CI that apply migrations as a
separate step). For a single command that does everything Vercel needs, use:

```bash
npm run vercel-build   # prisma generate && prisma migrate deploy && next build
```

## Deployment (Vercel) — exact steps

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import it in Vercel. Vercel will detect Next.js automatically.
3. In **Project Settings → Build & Development Settings**, confirm the Build Command is
   `npm run vercel-build` and Install Command is `npm ci` — both are already set via
   `vercel.json` in this repo, so you shouldn't need to change anything.
4. In **Project Settings → Environment Variables**, add every variable from the table above
   (`DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `ENCRYPTION_SECRET` at minimum) for the
   Production (and Preview, if you want preview deploys to work) environment.
5. Provision managed Postgres — e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com),
   or Vercel Postgres — and set `DATABASE_URL` to its connection string (use the *pooled*
   connection string if your provider distinguishes one; Vercel functions are short-lived and
   benefit from connection pooling).
6. Provision managed Redis — e.g. [Upstash](https://upstash.com) — and set `REDIS_URL`.
7. Set `NEXT_PUBLIC_APP_URL` to your production domain (e.g. `https://your-app.vercel.app`).
8. Deploy. `vercel-build` will run `prisma generate`, then `prisma migrate deploy` against
   `DATABASE_URL` (applying `prisma/migrations/*` — safe to re-run, already-applied migrations
   are skipped), then `next build`.
9. The agent run endpoint is publicly reachable at
   `https://<your-domain>/api/deploy/{endpointSlug}/run` once an agent is deployed from the
   Deployments page, and requires an `Authorization: Bearer <api key>` header.

**Runtime notes:** `src/app/api/agents/[id]/run` and `src/app/api/deploy/[slug]/run` both
declare `export const runtime = "nodejs"` (required — they use `ReadableStream`, Prisma, and
Node's `crypto`/`dns` modules, none of which run on the Edge runtime) and
`export const maxDuration = 60`. Raise `maxDuration` if your Vercel plan supports longer
function execution, and correspondingly raise `MAX_EXECUTION_MS` in
`src/lib/agent-runner/engine.ts` (kept a few seconds under `maxDuration` to leave room for
cleanup/persistence after the deadline fires).

### Google OAuth — production setup

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create
   an OAuth 2.0 Client ID (type: Web application).
2. Add `https://<your-domain>/api/auth/google/callback` as an **Authorized redirect URI**
   — it must match `GOOGLE_REDIRECT_URI` exactly, including scheme and trailing slash (or
   lack thereof).
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Vercel's
   environment variables.
4. The callback route validates CSRF `state` (via a short-lived httpOnly cookie) and requires
   Google's `email_verified: true` before creating a session — sign-in fails closed on any
   OAuth error rather than silently proceeding.

### AI provider setup

No provider keys are set as environment variables. After deploying, sign in, go to
**Models**, and add a provider:

- **Anthropic** — get a key at [console.anthropic.com](https://console.anthropic.com).
  Current model IDs used as defaults: `claude-sonnet-5`, `claude-opus-4-8`,
  `claude-haiku-4-5-20251001`.
- **OpenAI** — get a key at [platform.openai.com](https://platform.openai.com). Current
  defaults: `gpt-5.6-sol` (flagship reasoning/coding), `gpt-5.6-terra` (balanced), `gpt-4o`
  (kept for audio input/output — GPT-5.6 does not do audio). GPT-5.6 GA'd July 9, 2026 and
  superseded GPT-5.4; `gpt-5.4`/`gpt-5.4-mini` still work via direct API calls but are no
  longer the recommended default.
- **Google Gemini** — get a key at [aistudio.google.com](https://aistudio.google.com).
  Current defaults: `gemini-3.6-flash` (GA July 21, 2026, recommended default),
  `gemini-3.1-pro` (strongest reasoning), `gemini-3.5-flash-lite` (cheapest). Gemini 1.x and
  2.0 are fully shut down; Gemini 2.5 models remain available but Google's own docs schedule
  most `gemini-2.5-*` variants for shutdown in 2026 — prefer 3.x.

Provider model lineups change on their own schedule — if a model ID starts failing, check
each provider's docs and update the model field on the provider record (or type a new model
ID directly into an LLM node's config in the builder).

## Testing

A focused test suite covers the security-critical logic — run it against a local Postgres +
Redis (the same `docker compose up -d` from "Database setup" works):

```bash
npm run test
```

Covers, against the real shipped modules (not reimplementations):
- `lib/crypto.ts` — encrypt/decrypt round-trip, ciphertext tamper detection, API key hashing
- `lib/security/safe-fetch.ts` — SSRF blocking (localhost, private/link-local ranges, cloud
  metadata IP, non-http(s) schemes, `.internal`/`.local` hostnames), timeout enforcement,
  response-size capping, against a real public HTTPS host
- `lib/rate-limit.ts` — real Redis-backed limit/block/reset behavior, per-identifier and
  per-bucket isolation
- `lib/agent-runner/validate.ts` — every graph-validation rule (unknown node types, duplicate
  IDs, dangling edges, node/payload size caps, multiple Start nodes)
- `lib/agent-runner/engine.ts` — the real execution engine: step-limit guard, AbortSignal
  propagation, Condition-node routing (including a regression test for a string-literal
  parsing bug found and fixed during this audit), Code-execution fails closed
- Database flow (via a real, migrated Postgres, using the actual `bcryptjs`/crypto modules
  through raw SQL mirroring the Prisma-based routes — see the file header comment in
  `tests/db-flow.test.ts` for why): registration + unique email, login verification,
  project/agent/node/edge creation with cascading deletes, deployment slug uniqueness,
  and the full API-key lifecycle (create → authenticate → revoke → reject revoked key →
  agent-scope enforcement)

This is not a full end-to-end test of the running Next.js server (that requires a real
generated Prisma Client — see "Known limitations"), but it directly exercises every
security-sensitive code path outside of the HTTP route handlers themselves.

## Redis — what it's actually used for

Redis is a **required** production dependency: it's the backing store for
`src/lib/rate-limit.ts`, which throttles login, registration, agent execution, API key
creation, and MCP connection testing. If Redis is down, the app still serves requests
(rate limiting fails open with a logged warning) rather than hard-failing — but that means
no real rate limiting is happening, so don't treat "app still runs without Redis" as
"Redis is optional" in production.

## Security notes

- Model provider keys and MCP server auth headers are AES-256-GCM encrypted at rest and
  only ever decrypted server-side.
- API keys are stored as SHA-256 hashes; the full key is shown exactly once, at creation.
  Keys can be scoped to a single agent or left account-wide.
- Sessions are signed JWTs in an `httpOnly`, `sameSite=lax` cookie.
- All outbound requests driven by user input (HTTP Request tool, Custom API tool, MCP client)
  go through `lib/security/safe-fetch.ts`, which blocks requests to localhost, private/
  link-local IP ranges, and cloud metadata endpoints (including via DNS rebinding), validates
  redirect targets, and enforces timeouts + response-size caps.
- Agent graphs are server-side validated (allowed node types, max node/edge counts, no
  duplicate IDs, all edge references resolve, payload size cap) before being persisted.
- The Code Execution tool is disabled by design — see "What's implemented vs. what's a stub."
- Every resource route (`/api/agents/*`, `/api/projects`, `/api/mcp-servers/*`,
  `/api/models`, `/api/api-keys/*`, `/api/deployments/*`) verifies ownership through the
  authenticated session/API key before reading or writing — see each route's `ownedAgent`/
  `where: { userId }` checks.

## Known limitations (read before production use)

- **Tool catalog enablement is global, not per-user.** Any authenticated user can toggle a
  built-in tool on/off for the whole deployment. Fine for single-tenant/self-hosted use;
  needs a `UserToolConfig` join table for real multi-tenant isolation.
- **No live end-to-end test against a real Next.js server.** The test suite (see "Testing")
  exercises every security-critical module directly, and the initial migration has been
  applied to and verified against a real Postgres instance — but running the actual HTTP
  route handlers (`next start` + real requests) requires a Prisma Client generated with
  network access to `binaries.prisma.sh`, which wasn't available in the environment this was
  built in. Do this once, locally, before your first real deploy: `npm install && npm run dev`,
  then click through Register → Login → create a project/agent → save the graph → add a
  Model provider key → Test Agent in the Playground → Deploy → create an API key → call
  `POST /api/deploy/{slug}/run` → revoke the key → confirm the revoked key is rejected (401).
- **Prisma engine binaries** are fetched from `binaries.prisma.sh` at `npm install` /
  `prisma generate` time — if you're deploying from a network that blocks that domain (some
  corporate proxies, sandboxed CI), generation will fail. Vercel's build environment has
  normal internet access, so this is a non-issue there.
- **Memory nodes are pass-through.** See "What's implemented vs. what's a stub" above.
- **Human Approval nodes pause but don't yet support resuming** a run from the UI.
