import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/db";
import { embedTexts, toVectorLiteral } from "../lib/embed";
import { searchChunks } from "../lib/retrieve";

type EvalQuestion = {
  id: string;
  role: "member" | "admin";
  question: string;
  document?: string;
  snippet?: string;
  expect?: "hit" | "none";
};

const questions = JSON.parse(
  readFileSync(path.join(process.cwd(), "evals", "questions.json"), "utf8"),
) as EvalQuestion[];

function wordCount(snippet: string) {
  return snippet.trim().split(/\s+/).length;
}

async function main() {
  const team = await prisma.team.findFirstOrThrow({ where: { name: "Demo" } });
  const documents = await prisma.document.findMany({
    where: { teamId: team.id },
    select: { title: true, text: true },
  });
  const byTitle = new Map(documents.map((document) => [document.title, document.text]));

  for (const q of questions) {
    if (q.expect === "none") continue;
    if (!q.document || !q.snippet) {
      throw new Error(`Invalid question ${q.id}: scored questions need a document and a snippet.`);
    }
    const words = wordCount(q.snippet);
    if (words < 3 || words > 6) {
      throw new Error(`Invalid question ${q.id}: snippet must be 3 to 6 words.`);
    }
    const text = byTitle.get(q.document);
    if (!text || !text.includes(q.snippet)) {
      throw new Error(`Invalid question ${q.id}: snippet is not in ${q.document}.`);
    }
  }

  const adminChunkIds = new Set(
    (
      await prisma.chunk.findMany({
        where: { visibility: "admins" },
        select: { id: true },
      })
    ).map((chunk) => chunk.id),
  );

  const users = {
    member: await prisma.user.findUniqueOrThrow({
      where: { email: "member@citedocs.test" },
      include: { memberships: true },
    }),
    admin: await prisma.user.findUniqueOrThrow({
      where: { email: "admin@citedocs.test" },
      include: { memberships: true },
    }),
  };

  let scored = 0;
  let hits = 0;

  for (const q of questions) {
    const [embedding] = await embedTexts([q.question], "query");
    const hitsForQuestion = await searchChunks(
      users[q.role].memberships,
      toVectorLiteral(embedding),
    );
    const results = hitsForQuestion.map((hit) => ({
      chunkId: hit.id,
      title: hit.title,
      distance: hit.distance,
    }));

    if (q.role === "member") {
      const leaked = results.filter((r) => adminChunkIds.has(r.chunkId));
      if (leaked.length) {
        throw new Error(`LEAK on ${q.id}: member got an admins chunk`);
      }
    }

    if (q.expect === "none") {
      console.log(`${q.id} none ${results.map((r) => r.title).join(", ") || "no chunks"}`);
      continue;
    }

    const expected = await prisma.chunk.findMany({
      where: {
        document: { title: q.document, teamId: team.id },
        text: { contains: q.snippet },
      },
      select: { id: true },
    });
    const expectedIds = new Set(expected.map((chunk) => chunk.id));
    const hit = results.some((r) => expectedIds.has(r.chunkId));
    scored += 1;
    if (hit) hits += 1;
    const top = results.map((r) => `${r.title} ${r.distance.toFixed(3)}`).join(", ") || "none";
    console.log(`${hit ? "hit" : "miss"} ${q.id} ${top}`);
  }

  const rate = scored === 0 ? 0 : (hits / scored) * 100;
  console.log(`Hit@5 ${hits}/${scored} (${rate.toFixed(1)}%)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
