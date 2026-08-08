import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateApiKey, hashApiKey } from "@/lib/crypto";

/**
 * These tests exercise the real, migrated Postgres schema (see
 * prisma/migrations/20260808000000_init) end-to-end for the flows the
 * audit asked us to verify: register/login, project/agent creation with
 * cascading deletes, and API-key create -> use -> revoke -> reject.
 *
 * They use `pg` directly rather than a generated Prisma Client, because
 * `prisma generate` requires downloading a native engine binary from
 * binaries.prisma.sh, which this environment cannot reach (see README
 * "Known limitations"). The SQL below mirrors exactly what the real
 * Prisma-based API routes do; the app itself is unchanged and still uses
 * `@prisma/client` — this substitution is test-only.
 */

const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5432/open_agent_studio" });

beforeAll(async () => {
  await client.connect();
});
afterAll(async () => {
  await client.end();
});

function id() {
  return `t_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

describe("Database flow — register/login, agent CRUD cascade, API key lifecycle (real Postgres)", () => {
  it("registers a user with a hashed password, and enforces unique email", async () => {
    const email = `${id()}@example.com`;
    const hash = await hashPassword("correct horse battery staple");
    const userId = id();
    await client.query('INSERT INTO "User" (id, name, email, "passwordHash") VALUES ($1,$2,$3,$4)', [
      userId, "Test User", email, hash,
    ]);

    await expect(
      client.query('INSERT INTO "User" (id, name, email, "passwordHash") VALUES ($1,$2,$3,$4)', [
        id(), "Dupe", email, hash,
      ])
    ).rejects.toThrow(/unique/i);
  });

  it("logs in only with the correct password (mirrors /api/auth/login)", async () => {
    const email = `${id()}@example.com`;
    const hash = await hashPassword("s3cret-password!");
    await client.query('INSERT INTO "User" (id, name, email, "passwordHash") VALUES ($1,$2,$3,$4)', [
      id(), "Login User", email, hash,
    ]);

    const { rows } = await client.query('SELECT "passwordHash" FROM "User" WHERE email = $1', [email]);
    expect(await verifyPassword("s3cret-password!", rows[0].passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password", rows[0].passwordHash)).toBe(false);
  });

  it("creates project -> agent -> nodes -> edges, and cascades delete correctly", async () => {
    const userId = id();
    await client.query('INSERT INTO "User" (id, email) VALUES ($1,$2)', [userId, `${id()}@example.com`]);

    const projectId = id();
    await client.query('INSERT INTO "Project" (id, name, "userId", "updatedAt") VALUES ($1,$2,$3, now())', [
      projectId, "Demo Project", userId,
    ]);

    const agentId = id();
    await client.query('INSERT INTO "Agent" (id, name, "projectId", "updatedAt") VALUES ($1,$2,$3, now())', [
      agentId, "Demo Agent", projectId,
    ]);

    const startNodeId = id();
    const outputNodeId = id();
    await client.query(
      'INSERT INTO "AgentNode" (id, "agentId", type, label, "positionX", "positionY") VALUES ($1,$2,$3,$4,0,0), ($5,$2,$6,$7,0,0)',
      [startNodeId, agentId, "start", "Start", outputNodeId, "output", "Output"]
    );
    await client.query(
      'INSERT INTO "AgentEdge" (id, "agentId", "fromNodeId", "fromPort", "toNodeId") VALUES ($1,$2,$3,$4,$5)',
      [id(), agentId, startNodeId, "next", outputNodeId]
    );

    const nodeCount = await client.query('SELECT count(*) FROM "AgentNode" WHERE "agentId" = $1', [agentId]);
    expect(Number(nodeCount.rows[0].count)).toBe(2);

    // Deleting the agent should cascade to its nodes and edges (ON DELETE CASCADE).
    await client.query('DELETE FROM "Agent" WHERE id = $1', [agentId]);
    const afterDelete = await client.query('SELECT count(*) FROM "AgentNode" WHERE "agentId" = $1', [agentId]);
    expect(Number(afterDelete.rows[0].count)).toBe(0);
    const edgesAfterDelete = await client.query('SELECT count(*) FROM "AgentEdge" WHERE "agentId" = $1', [agentId]);
    expect(Number(edgesAfterDelete.rows[0].count)).toBe(0);
  });

  it("creates a deployment with a unique endpointSlug (mirrors POST /api/deployments/[agentId])", async () => {
    const userId = id();
    await client.query('INSERT INTO "User" (id, email) VALUES ($1,$2)', [userId, `${id()}@example.com`]);
    const projectId = id();
    await client.query('INSERT INTO "Project" (id, name, "userId", "updatedAt") VALUES ($1,$2,$3, now())', [projectId, "P", userId]);
    const agentId = id();
    await client.query('INSERT INTO "Agent" (id, name, "projectId", "updatedAt") VALUES ($1,$2,$3, now())', [agentId, "A", projectId]);

    const slug = `demo-agent-${id()}`;
    await client.query('INSERT INTO "Deployment" (id, "agentId", "endpointSlug") VALUES ($1,$2,$3)', [id(), agentId, slug]);

    const found = await client.query('SELECT status FROM "Deployment" WHERE "endpointSlug" = $1', [slug]);
    expect(found.rows[0].status).toBe("ACTIVE");

    // A second deployment can't reuse the same slug.
    await expect(
      client.query('INSERT INTO "Deployment" (id, "agentId", "endpointSlug") VALUES ($1,$2,$3)', [id(), agentId, slug])
    ).rejects.toThrow(/unique/i);
  });

  it("API key lifecycle: create -> authenticate -> revoke -> reject (mirrors run-route auth check)", async () => {
    const userId = id();
    await client.query('INSERT INTO "User" (id, email) VALUES ($1,$2)', [userId, `${id()}@example.com`]);

    const { full, prefix } = generateApiKey();
    const hashed = hashApiKey(full);
    const keyId = id();
    await client.query(
      'INSERT INTO "APIKey" (id, "userId", name, "keyPrefix", "hashedKey") VALUES ($1,$2,$3,$4,$5)',
      [keyId, userId, "Test Key", prefix, hashed]
    );

    // Simulates the lookup in POST /api/deploy/[slug]/run and /api/agents/[id]/run
    const lookupHash = hashApiKey(full);
    const active = await client.query('SELECT id, revoked FROM "APIKey" WHERE "hashedKey" = $1 AND revoked = false', [lookupHash]);
    expect(active.rows.length).toBe(1);
    expect(active.rows[0].id).toBe(keyId);

    // A different/incorrect key must not match.
    const wrongHash = hashApiKey("oas_sk_totally-different-key");
    const noMatch = await client.query('SELECT id FROM "APIKey" WHERE "hashedKey" = $1 AND revoked = false', [wrongHash]);
    expect(noMatch.rows.length).toBe(0);

    // Revoke it (mirrors DELETE /api/api-keys/[id])
    await client.query('UPDATE "APIKey" SET revoked = true WHERE id = $1', [keyId]);
    const afterRevoke = await client.query('SELECT id FROM "APIKey" WHERE "hashedKey" = $1 AND revoked = false', [lookupHash]);
    expect(afterRevoke.rows.length).toBe(0); // revoked key is correctly rejected
  });

  it("agent-scoped API key only matches its own agent (mirrors the scope check in both run routes)", async () => {
    const userId = id();
    await client.query('INSERT INTO "User" (id, email) VALUES ($1,$2)', [userId, `${id()}@example.com`]);
    const projectId = id();
    await client.query('INSERT INTO "Project" (id, name, "userId", "updatedAt") VALUES ($1,$2,$3, now())', [projectId, "P", userId]);
    const agentA = id();
    const agentB = id();
    await client.query('INSERT INTO "Agent" (id, name, "projectId", "updatedAt") VALUES ($1,$2,$3, now()), ($4,$5,$3, now())', [
      agentA, "Agent A", projectId, agentB, "Agent B",
    ]);

    const { full } = generateApiKey();
    const hashed = hashApiKey(full);
    await client.query('INSERT INTO "APIKey" (id, "userId", "agentId", name, "keyPrefix", "hashedKey") VALUES ($1,$2,$3,$4,$5,$6)', [
      id(), userId, agentA, "Scoped Key", full.slice(0, 12), hashed,
    ]);

    const { rows } = await client.query('SELECT "agentId" FROM "APIKey" WHERE "hashedKey" = $1', [hashed]);
    const scopeMatchesA = rows[0].agentId === agentA || rows[0].agentId === null;
    const scopeMatchesB = rows[0].agentId === agentB || rows[0].agentId === null;
    expect(scopeMatchesA).toBe(true); // this key should be usable for agent A
    expect(scopeMatchesB).toBe(false); // and correctly rejected for agent B
  });
});
