# 🤖 Open Agent Studio

> **An open-source visual AI Agent Builder for designing, testing, configuring, and deploying AI agents.**

Open Agent Studio is a full-stack platform that provides a visual environment for building and managing AI agents with customizable models, tools, workflows, and API deployments.

The platform combines a visual node-based agent builder with a streaming execution engine, AI model integrations, encrypted secrets, API key management, MCP support, rate limiting, and security-focused infrastructure.

### 🌐 Live Demo

**Try Open Agent Studio:** https://ai-agent-hub-mu.vercel.app/

> 🚧 **Project Status:** Working full-stack scaffold / Active Development

---

## ✨ Features

### 🎨 Visual AI Agent Builder

* Build AI agents visually using a node-based canvas.
* Powered by `@xyflow/react`.
* Configure agent workflows through connected nodes.
* Server-side graph validation.
* Configuration size limits for safer execution.

### 🧠 AI Model Integration

Supports configurable AI model providers including:

* OpenAI
* Anthropic
* Google Gemini

Provider API keys can be configured through the application's Models page and are encrypted before being stored.

### ⚡ Streaming Agent Execution

* Real-time streaming execution using Server-Sent Events (SSE).
* Usage-based token accounting.
* Execution deadlines.
* Maximum-step protection.
* Client disconnect handling with `AbortSignal`.

### 🔐 Security

Security is a major focus of Open Agent Studio.

* AES-256-GCM encryption for provider keys and MCP authentication headers.
* SHA-256 hashing for API keys.
* HTTP-only JWT session cookies.
* CSRF protection for Google OAuth.
* SSRF protection for outbound requests.
* DNS rebinding protection.
* Redirect validation.
* Request timeouts.
* Response-size limits.
* Server-side ownership validation.

### 🔑 API Key Management

* Account-wide API keys.
* Agent-scoped API keys.
* API keys are hashed before storage.
* Full API key displayed only once during creation.
* API key revocation support.

### 🚀 Agent Deployment

Agents can be deployed through public API endpoints:

```text
/api/deploy/{slug}/run
```

Deployed agents require an API key:

```http
Authorization: Bearer <api-key>
```

### 🔌 MCP Support

Open Agent Studio includes an MCP JSON-RPC client with security-hardened outbound requests.

### 🚦 Rate Limiting

Redis-backed rate limiting protects sensitive operations including:

* Login
* Registration
* Agent execution
* API key creation
* MCP connection testing

---

## 🛠️ Tech Stack

| Technology      | Purpose                  |
| --------------- | ------------------------ |
| Next.js 15      | Full-stack web framework |
| TypeScript      | Application development  |
| React           | UI development           |
| Tailwind CSS    | Styling                  |
| `@xyflow/react` | Visual agent builder     |
| PostgreSQL      | Database                 |
| Prisma          | ORM                      |
| Redis           | Rate limiting            |
| ioredis         | Redis client             |
| Zod             | Validation               |
| jose            | JWT authentication       |
| bcryptjs        | Password hashing         |

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   ├── api/
│   │   ├── agents/[id]/run/
│   │   └── deploy/[slug]/run/
│   └── page.tsx
│
├── components/
│   ├── builder/
│   └── ui/
│
└── lib/
    ├── models/
    ├── tools/
    ├── mcp/
    ├── security/
    ├── agent-runner/
    ├── auth/
    ├── rate-limit.ts
    ├── prisma.ts
    ├── redis.ts
    └── crypto.ts

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

docker-compose.yml
vercel.json
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have:

* Node.js 20+
* PostgreSQL
* Redis
* Docker — optional but recommended for local development

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/open-agent-studio.git
cd open-agent-studio
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Add the required values:

```env
DATABASE_URL="your-postgresql-connection-string"
REDIS_URL="your-redis-connection-string"
AUTH_SECRET="your-auth-secret"
ENCRYPTION_SECRET="your-encryption-secret"
```

Generate secure secrets with:

```bash
openssl rand -base64 32
```

### 4. Start PostgreSQL and Redis

Using Docker:

```bash
docker compose up -d
```

### 5. Run Database Migration

For local development:

```bash
npm run prisma:migrate
```

For an existing migration history:

```bash
npm run prisma:deploy
```

### 6. Seed Demo Data

```bash
npm run db:seed
```

The seed creates a demo account:

```text
Email: demo@openagentstudio.dev
Password: password123
```

> For production deployments, replace demo credentials and seed data with secure production configuration.

### 7. Start the Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🔑 Environment Variables

| Variable               | Required | Description                             |
| ---------------------- | :------: | --------------------------------------- |
| `DATABASE_URL`         |     ✅    | PostgreSQL connection string            |
| `REDIS_URL`            |     ✅    | Redis connection used for rate limiting |
| `AUTH_SECRET`          |     ✅    | Signs authentication JWTs               |
| `ENCRYPTION_SECRET`    |     ✅    | Encrypts sensitive provider credentials |
| `GOOGLE_CLIENT_ID`     | Optional | Google OAuth client ID                  |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret              |
| `GOOGLE_REDIRECT_URI`  | Optional | Google OAuth callback URL               |
| `SEARCH_API_KEY`       | Optional | Enables Web Search functionality        |
| `NEXT_PUBLIC_APP_URL`  | Optional | Production application URL              |

> AI provider keys are configured inside the application rather than being stored directly as environment variables.

---

## 🌐 Deployment with Vercel

Open Agent Studio can be deployed to Vercel.

### Build Command

```bash
npm run vercel-build
```

### Install Command

```bash
npm ci
```

The production build performs:

```text
Prisma Generate
      ↓
Prisma Migration Deploy
      ↓
Next.js Build
```

For production, configure:

* PostgreSQL database
* Redis instance
* Authentication secret
* Encryption secret
* Production application URL

Recommended infrastructure options include:

* Neon
* Supabase
* Vercel Postgres
* Upstash Redis

---

## 🧪 Testing

Run the test suite:

```bash
npm run test
```

Tests cover security-critical functionality including:

* Encryption/decryption
* API key hashing
* SSRF protection
* Rate limiting
* Agent graph validation
* Execution engine safeguards
* Database flows
* API key lifecycle
* Agent ownership enforcement

---

## 🔒 Security Architecture

Open Agent Studio follows a layered security architecture:

```text
User Input
    ↓
Server Validation
    ↓
Ownership Verification
    ↓
Graph Validation
    ↓
Security-Hardened Tool Execution
    ↓
Rate Limiting
    ↓
Streaming Agent Execution
```

Sensitive credentials are never returned to the browser.

Outbound user-controlled requests pass through a security-hardened fetch layer that protects against:

* Localhost access
* Private networks
* Cloud metadata endpoints
* DNS rebinding
* Unsafe redirects
* Excessive response sizes
* Long-running requests

---

## ⚠️ Current Limitations

Open Agent Studio is currently an active development project and is **not yet a fully audited commercial product**.

Current limitations include:

* Code Execution is disabled.
* Database Query and Email tools are currently stubbed.
* Memory configuration exists, but vector retrieval and cross-session persistence are not yet implemented.
* Human Approval nodes can pause execution but do not currently support resuming through the UI.
* Tool enable/disable configuration is currently global rather than per-user.
* A complete live end-to-end test against the deployed Next.js server is still recommended before production use.

See the project documentation for the complete list of limitations.

---

## 🗺️ Roadmap

* [ ] Production sandbox for Code Execution
* [ ] Database connector system
* [ ] Email provider integration
* [ ] Persistent agent memory
* [ ] Vector database integration
* [ ] Resume support for Human Approval nodes
* [ ] Per-user tool configuration
* [ ] Expanded model provider support
* [ ] More built-in AI tools
* [ ] Improved monitoring and analytics
* [ ] Full end-to-end production testing

---

## 🤝 Contributing

Contributions are welcome!

### 1. Fork the repository

### 2. Create a feature branch

```bash
git checkout -b feature/your-feature
```

### 3. Make your changes

### 4. Run the tests

```bash
npm run test
```

### 5. Commit your changes

```bash
git commit -m "feat: add your feature"
```

### 6. Push your branch

```bash
git push origin feature/your-feature
```

### 7. Open a Pull Request

---

## 📄 License

This project is open source. See the repository license for details.

---

## ⭐ Support

If you find Open Agent Studio useful, consider giving the repository a ⭐ on GitHub.

Built with ❤️ using Next.js, TypeScript, PostgreSQL, Prisma, Redis, and AI APIs.

### 🌐 Live Demo

https://ai-agent-hub-mu.vercel.app/
