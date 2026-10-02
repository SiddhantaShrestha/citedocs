import { splitChunks } from "@/lib/chunk";
import { prisma } from "@/lib/db";
import { embedTexts, toVectorLiteral } from "@/lib/embed";

export async function ingestDocument(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document) {
    throw new Error("Document not found.");
  }

  const chunks = splitChunks(document.text);
  if (chunks.length === 0) {
    throw new Error("This document has no text.");
  }

  const embeddings = await embedTexts(chunks, "document");

  await prisma.$transaction(async (tx) => {
    await tx.chunk.deleteMany({ where: { documentId } });

    for (let position = 0; position < chunks.length; position++) {
      const chunk = await tx.chunk.create({
        data: {
          documentId,
          teamId: document.teamId,
          visibility: document.visibility,
          position,
          text: chunks[position],
        },
      });
      await tx.$executeRawUnsafe(
        `UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2`,
        toVectorLiteral(embeddings[position]),
        chunk.id,
      );
    }
  });

  return chunks.length;
}
