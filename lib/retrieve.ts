import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";

const TOP_K = 5;
const MAX_DISTANCE = 0.5;

export type Hit = {
  id: string;
  text: string;
  title: string;
  distance: number;
};

function accessFilter(memberships: { teamId: string; role: Role }[]) {
  return Prisma.join(
    memberships.map((membership) =>
      membership.role === "admin"
        ? Prisma.sql`c."teamId" = ${membership.teamId}`
        : Prisma.sql`(c."teamId" = ${membership.teamId} AND c.visibility::text = 'team')`,
    ),
    " OR ",
  );
}

export async function searchChunks(
  memberships: { teamId: string; role: Role }[],
  vectorLiteral: string,
) {
  if (memberships.length === 0) return [];

  const access = accessFilter(memberships);
  const rows = await prisma.$queryRaw<Hit[]>`
    SELECT c.id, c.text, d.title, (c.embedding <=> ${vectorLiteral}::vector) AS distance
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE c.embedding IS NOT NULL
      AND (${access})
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${TOP_K}
  `;

  return rows
    .map((row) => ({ ...row, distance: Number(row.distance) }))
    .filter((row) => row.distance <= MAX_DISTANCE);
}

export async function chunksById(
  memberships: { teamId: string; role: Role }[],
  ids: string[],
) {
  if (memberships.length === 0 || ids.length === 0) return [];

  const access = accessFilter(memberships);
  const idList = Prisma.join(ids);
  return prisma.$queryRaw<{ id: string; text: string; title: string }[]>`
    SELECT c.id, c.text, d.title
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE c.id IN (${idList})
      AND (${access})
  `;
}
