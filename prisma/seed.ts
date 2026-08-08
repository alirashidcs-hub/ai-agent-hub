import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@openagentstudio.dev";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User", passwordHash: await hashPassword("password123") },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: { id: "demo-project", name: "Demo Workspace", description: "Seeded example agents", userId: user.id },
  });

  const demoAgents = [
    { name: "Research Assistant", description: "Searches the web and synthesizes findings." },
    { name: "Customer Support Agent", description: "Answers product questions with tool access." },
    { name: "AI Data Analyst", description: "Analyzes data and answers questions about it." },
  ];

  for (const def of demoAgents) {
    const existing = await prisma.agent.findFirst({ where: { name: def.name, projectId: project.id } });
    if (existing) continue;

    const agent = await prisma.agent.create({
      data: {
        name: def.name,
        description: def.description,
        projectId: project.id,
        nodes: {
          create: [
            { type: "start", label: "Start", positionX: 60, positionY: 160, config: {} },
            { type: "llm", label: "Claude Sonnet", positionX: 340, positionY: 160, config: { provider: "anthropic", model: "claude-sonnet-5", temperature: 0.7 } },
            { type: "output", label: "Final Output", positionX: 640, positionY: 160, config: {} },
          ],
        },
      },
      include: { nodes: true },
    });

    const [start, llm, output] = agent.nodes;
    await prisma.agentEdge.createMany({
      data: [
        { agentId: agent.id, fromNodeId: start.id, fromPort: "next", toNodeId: llm.id },
        { agentId: agent.id, fromNodeId: llm.id, fromPort: "next", toNodeId: output.id },
      ],
    });
  }

  console.log(`Seeded demo user: ${email} / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
