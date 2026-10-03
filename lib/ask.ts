import { prisma } from "@/lib/db";
import { embed, toVectorLiteral } from "@/lib/embed";
import { writeAnswer } from "@/lib/answer";
import { assertIndexMatchesProvider } from "@/lib/index-guard";
import { assertAskAllowed } from "@/lib/rate-limit";
import { chunksById, searchChunks } from "@/lib/retrieve";

export async function askQuestion(userId: string, question: string) {
  const trimmed = question.trim();
  if (!trimmed) throw new Error("Enter a question.");
  if (trimmed.length > 500) throw new Error("Question is too long.");

  await assertIndexMatchesProvider();
  await assertAskAllowed(userId);

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true, role: true },
  });

  const [embedding] = await embed([trimmed], "query");
  const retrieved = await attachDocumentIds(
    await searchChunks(memberships, toVectorLiteral(embedding)),
  );
  const { answer, cited } = await writeAnswer(trimmed, retrieved);
  const sources = cited.length ? [...new Set(cited)].map((i) => retrieved[i]) : [];

  const saved = await prisma.question.create({
    data: {
      userId,
      question: trimmed,
      answer,
      chunkIds: sources.map((source) => source.id),
    },
  });

  return { question: saved, sources };
}

export async function latestAnswer(userId: string) {
  const saved = await prisma.question.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!saved) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true, role: true },
  });
  const sources = await attachDocumentIds(
    await chunksById(memberships, saved.chunkIds),
  );
  return { question: saved, sources };
}

async function attachDocumentIds<T extends { id: string }>(sources: T[]) {
  if (sources.length === 0) return [];

  const rows = await prisma.chunk.findMany({
    where: { id: { in: sources.map((source) => source.id) } },
    select: { id: true, documentId: true },
  });
  const documentIds = new Map(rows.map((row) => [row.id, row.documentId]));

  return sources.flatMap((source) => {
    const documentId = documentIds.get(source.id);
    return documentId ? [{ ...source, documentId }] : [];
  });
}
