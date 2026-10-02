import { prisma } from "@/lib/db";
import { embedTexts, toVectorLiteral } from "@/lib/embed";
import { writeAnswer } from "@/lib/answer";
import { chunksById, searchChunks } from "@/lib/retrieve";

export async function askQuestion(userId: string, question: string) {
  const trimmed = question.trim();
  if (!trimmed) throw new Error("Enter a question.");
  if (trimmed.length > 500) throw new Error("Question is too long.");

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true, role: true },
  });

  const [embedding] = await embedTexts([trimmed], "query");
  const sources = await searchChunks(memberships, toVectorLiteral(embedding));
  const answer = await writeAnswer(trimmed, sources);

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
  const sources = await chunksById(memberships, saved.chunkIds);
  return { question: saved, sources };
}
