import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../lib/db";
import { embed, toVectorLiteral } from "../lib/embed";
import { assertIndexMatchesProvider } from "../lib/index-guard";
import { searchChunks } from "../lib/retrieve";

type EvalQuestion = {
  id: string;
  role: "member" | "admin";
  question: string;
  document?: string;
  snippet?: string;
  expect?: "hit" | "none";
};

type Ranked = { chunkId: string; title: string };

const STOP = new Set(
  "a an the is are was were be been of to in on for and or do does did you your how what when where who which can if it this that with from by at as after before not no their them they we our i into about than then so just".split(
    " ",
  ),
);

const questions = JSON.parse(
  readFileSync(path.join(process.cwd(), "evals", "questions.json"), "utf8"),
) as EvalQuestion[];

function wordCount(snippet: string) {
  return snippet.trim().split(/\s+/).length;
}

function contentWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

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

function keywordQuery(question: string) {
  const tokens = contentWords(question)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  return tokens.length === 0 ? null : tokens.join(" | ");
}

async function keywordSearch(
  memberships: { teamId: string; role: Role }[],
  question: string,
) {
  const query = keywordQuery(question);
  if (memberships.length === 0 || !query) return [];
  const access = accessFilter(memberships);
  const rows = await prisma.$queryRaw<{ id: string; title: string }[]>`
    SELECT c.id, d.title
    FROM "Chunk" c
    JOIN "Document" d ON d.id = c."documentId"
    WHERE c.embedding IS NOT NULL
      AND (${access})
      AND to_tsvector('english', c.text) @@ to_tsquery('english', ${query})
    ORDER BY ts_rank(to_tsvector('english', c.text), to_tsquery('english', ${query})) DESC
    LIMIT 5
  `;
  return rows.map((row) => ({ chunkId: row.id, title: row.title }));
}

const RRF_K = 60;

function hybridSearch(vector: Ranked[], keyword: Ranked[]) {
  const scores = new Map<string, Ranked & { score: number; vectorRank: number }>();
  vector.forEach((item, index) => {
    scores.set(item.chunkId, { ...item, score: 1 / (RRF_K + index + 1), vectorRank: index });
  });
  keyword.forEach((item, index) => {
    const score = 1 / (RRF_K + index + 1);
    const prev = scores.get(item.chunkId);
    if (prev) prev.score += score;
    else scores.set(item.chunkId, { ...item, score, vectorRank: 99 });
  });
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.vectorRank - b.vectorRank)
    .slice(0, 5)
    .map(({ chunkId, title }) => ({ chunkId, title }));
}

function rankOf(results: Ranked[], expectedIds: Set<string>) {
  const index = results.findIndex((result) => expectedIds.has(result.chunkId));
  return index === -1 ? null : index + 1;
}

function rate(hits: number, total: number) {
  if (total === 0) return "0/0";
  return `${hits}/${total} (${((hits / total) * 100).toFixed(1)}%)`;
}

async function main() {
  const team = await prisma.team.findFirstOrThrow({ where: { name: "Demo" } });
  const documents = await prisma.document.findMany({
    where: { teamId: team.id },
    select: { title: true, text: true },
  });
  const byTitle = new Map(documents.map((document) => [document.title, document.text]));

  const scoredQuestions = questions.filter((q) => q.expect !== "none");
  for (const q of scoredQuestions) {
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
  console.log(`Snippet check passed for ${scoredQuestions.length} questions.`);
  await assertIndexMatchesProvider();

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

  const memberChunkCount = await prisma.chunk.count({
    where: {
      teamId: users.member.memberships[0].teamId,
      visibility: "team",
    },
  });
  const adminChunkCount = await prisma.chunk.count({
    where: { teamId: users.admin.memberships[0].teamId },
  });
  console.log(`Corpus: member can search ${memberChunkCount} chunks, admin ${adminChunkCount}.`);

  const totals = {
    scored: 0,
    vector: { h1: 0, h3: 0, h5: 0, mrr: 0 },
    keyword: { h1: 0, h3: 0, h5: 0, mrr: 0 },
    hybrid: { h1: 0, h3: 0, h5: 0, mrr: 0 },
  };
  let noneCount = 0;

  for (const q of questions) {
    const [embedding] = await embed([q.question], "query");
    const vectorHits = await searchChunks(users[q.role].memberships, toVectorLiteral(embedding));
    const vector: Ranked[] = vectorHits.map((hit) => ({ chunkId: hit.id, title: hit.title }));
    const keyword = await keywordSearch(users[q.role].memberships, q.question);
    const hybrid = hybridSearch(vector, keyword);

    if (q.role === "member") {
      const leaked = [...vector, ...keyword, ...hybrid].filter((r) => adminChunkIds.has(r.chunkId));
      if (leaked.length) {
        throw new Error(`LEAK on ${q.id}: member got an admins chunk`);
      }
    }

    if (q.expect === "none") {
      noneCount += 1;
      console.log(
        `${q.id} none vector [${vector.map((r) => r.title).join(", ") || "no chunks"}] keyword [${keyword.map((r) => r.title).join(", ") || "no chunks"}] hybrid [${hybrid.map((r) => r.title).join(", ") || "no chunks"}]`,
      );
      continue;
    }

    const expected = await prisma.chunk.findMany({
      where: {
        document: { title: q.document, teamId: team.id },
        text: { contains: q.snippet },
      },
      select: { id: true, text: true },
    });
    const expectedIds = new Set(expected.map((chunk) => chunk.id));
    const chunkText = expected[0]?.text ?? "";
    const qWords = contentWords(q.question);
    const chunkWords = new Set(contentWords(chunkText));
    const shared = qWords.filter((word) => chunkWords.has(word));
    const overlap = qWords.length === 0 ? 0 : shared.length / qWords.length;

    const vectorRank = rankOf(vector, expectedIds);
    const keywordRank = rankOf(keyword, expectedIds);
    const hybridRank = rankOf(hybrid, expectedIds);
    totals.scored += 1;
    for (const [name, rank] of [
      ["vector", vectorRank],
      ["keyword", keywordRank],
      ["hybrid", hybridRank],
    ] as const) {
      const bucket = totals[name];
      if (rank === 1) bucket.h1 += 1;
      if (rank !== null && rank <= 3) bucket.h3 += 1;
      if (rank !== null && rank <= 5) bucket.h5 += 1;
      if (rank !== null) bucket.mrr += 1 / rank;
    }

    const flag = overlap > 0.6 ? " FLAG" : "";
    console.log(
      `${q.id}${flag} overlap ${(overlap * 100).toFixed(0)}% vector ${vectorRank ?? "miss"} keyword ${keywordRank ?? "miss"} hybrid ${hybridRank ?? "miss"}`,
    );
  }

  const scored = totals.scored;
  console.log(`None checks: ${noneCount}. Leak guard ran on every member question.`);
  console.log(`Vector Hit@1 ${rate(totals.vector.h1, scored)}  MRR ${(totals.vector.mrr / scored).toFixed(3)}`);
  console.log(`Vector Hit@3 ${rate(totals.vector.h3, scored)}`);
  console.log(`Vector Hit@5 ${rate(totals.vector.h5, scored)} (footnote)`);
  console.log(`Keyword Hit@1 ${rate(totals.keyword.h1, scored)}  MRR ${(totals.keyword.mrr / scored).toFixed(3)}`);
  console.log(`Keyword Hit@3 ${rate(totals.keyword.h3, scored)}`);
  console.log(`Keyword Hit@5 ${rate(totals.keyword.h5, scored)} (footnote)`);
  console.log(`Hybrid Hit@1 ${rate(totals.hybrid.h1, scored)}  MRR ${(totals.hybrid.mrr / scored).toFixed(3)}`);
  console.log(`Hybrid Hit@3 ${rate(totals.hybrid.h3, scored)}`);
  console.log(`Hybrid Hit@5 ${rate(totals.hybrid.h5, scored)} (footnote)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
