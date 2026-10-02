import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Visibility } from "@prisma/client";
import { prisma } from "../lib/db";
import { ingestDocument } from "../lib/ingest";

const DOCS_DIR = path.join(process.cwd(), "seed", "docs");

function parseDoc(raw: string, fileName: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${fileName} is missing frontmatter.`);
  }

  const fields = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const splitAt = line.indexOf(":");
    if (splitAt === -1) continue;
    fields.set(line.slice(0, splitAt).trim(), line.slice(splitAt + 1).trim());
  }

  const title = fields.get("title")?.trim() ?? "";
  const visibility = fields.get("visibility")?.trim() ?? "";
  const text = match[2].trim();

  if (!title) throw new Error(`${fileName} has no title.`);
  if (visibility !== "team" && visibility !== "admins") {
    throw new Error(`${fileName} visibility must be team or admins.`);
  }
  if (!text) throw new Error(`${fileName} has no body.`);

  return { title, visibility: visibility as Visibility, text };
}

async function main() {
  const team = await prisma.team.findFirst({ where: { name: "Demo" } });
  if (!team) {
    throw new Error('Demo team not found. Run "npm run db:seed" first.');
  }

  const fileNames = (await readdir(DOCS_DIR))
    .filter((name) => name.endsWith(".md"))
    .sort();

  for (const fileName of fileNames) {
    const raw = await readFile(path.join(DOCS_DIR, fileName), "utf8");
    const doc = parseDoc(raw, fileName);
    const existing = await prisma.document.findFirst({
      where: { teamId: team.id, title: doc.title },
    });

    if (
      existing &&
      existing.text === doc.text &&
      existing.visibility === doc.visibility
    ) {
      console.log(`skip ${doc.title}`);
      continue;
    }

    const saved = existing
      ? await prisma.document.update({
          where: { id: existing.id },
          data: { visibility: doc.visibility, text: doc.text },
        })
      : await prisma.document.create({
          data: {
            teamId: team.id,
            title: doc.title,
            visibility: doc.visibility,
            text: doc.text,
          },
        });

    const chunks = await ingestDocument(saved.id);
    console.log(`${existing ? "replace" : "create"} ${doc.title} (${chunks} chunks)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
