import { prisma } from "@/lib/db";
import { embeddingModelName } from "@/lib/model";

export async function assertIndexMatchesProvider() {
  const expected = embeddingModelName();
  const rows = await prisma.chunk.findMany({
    distinct: ["embeddingModel"],
    select: { embeddingModel: true },
  });
  if (rows.length === 0) return;
  if (rows.every((row) => row.embeddingModel === expected)) return;

  const found = rows.map((row) => row.embeddingModel ?? "unknown").join(", ");
  throw new Error(
    `Re-index before asking. Stored embeddings are ${found}, and the app is using ${expected}.`,
  );
}
