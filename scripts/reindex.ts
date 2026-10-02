import { prisma } from "../lib/db";
import { ingestDocument } from "../lib/ingest";

async function main() {
  const documents = await prisma.document.findMany({ select: { id: true, title: true } });
  for (const document of documents) {
    const chunks = await ingestDocument(document.id);
    console.log(`${document.title}: ${chunks} chunks`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
