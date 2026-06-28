import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../services/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.workspaceSettings.upsert({
    where: { id: "default" },
    create: { id: "default", consentVersion: "1.0", retentionDays: 90 },
    update: {},
  });

  await prisma.knowledgeBase.upsert({
    where: { id: "default-kb" },
    create: {
      id: "default-kb",
      name: "Base organizacional",
      description: "Documentos internos do escritório",
      active: true,
    },
    update: {},
  });

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const existing = await prisma.user.findUnique({ where: { username } });
  if (!existing) {
    await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: UserRole.admin,
        active: true,
        aiNoticeDismissed: true,
        mustChangePassword: false,
      },
    });
    console.log(`Admin criado: ${username}`);
  } else {
    console.log(`Admin já existe: ${username}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
