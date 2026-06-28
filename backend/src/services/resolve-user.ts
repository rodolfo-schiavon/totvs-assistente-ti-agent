import { prisma } from "../db";
import type { RequestAuth } from "../middleware/auth";

/** Mapeia sub JWT (id ou username legado) para o id real na tabela User. */
export async function resolveDbUserId(auth: RequestAuth | undefined): Promise<string | null> {
  if (!auth?.userId && !auth?.username) return null;

  if (auth.userId) {
    const byId = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (byId?.active) return byId.id;
  }

  const username = auth.username?.trim() || auth.userId?.trim();
  if (username) {
    const byUsername = await prisma.user.findUnique({ where: { username } });
    if (byUsername?.active) return byUsername.id;
  }

  return null;
}
