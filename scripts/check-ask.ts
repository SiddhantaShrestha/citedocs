import { PrismaClient } from "@prisma/client";
import { askQuestion } from "../lib/ask";
import { embed, toVectorLiteral } from "../lib/embed";
import { ingestDocument } from "../lib/ingest";
import { visibleDocumentsWhere } from "../lib/permissions";
import { searchChunks } from "../lib/retrieve";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@citedocs.test" },
    include: { memberships: true },
  });
  const member = await prisma.user.findUniqueOrThrow({
    where: { email: "member@citedocs.test" },
    include: { memberships: true },
  });

  const payroll = await prisma.chunk.findFirstOrThrow({
    where: { document: { title: "Payroll notes" } },
  });
  const handbook = await prisma.chunk.findFirstOrThrow({
    where: { document: { title: "Team handbook" } },
  });

  const [payrollVector] = await embed([payroll.text], "query");
  const memberHits = await searchChunks(
    member.memberships,
    toVectorLiteral(payrollVector),
  );
  const memberIds = memberHits.map((hit) => hit.id);
  if (memberIds.includes(payroll.id)) {
    throw new Error("A member retrieved the admins payroll chunk.");
  }
  console.log(
    "Member payroll search:",
    memberHits.map((hit) => `${hit.title} ${hit.distance.toFixed(3)}`).join(", ") ||
      "none",
  );

  const adminHits = await searchChunks(admin.memberships, toVectorLiteral(payrollVector));
  if (!adminHits.some((hit) => hit.id === payroll.id)) {
    throw new Error(
      `Admin missed the payroll chunk: ${adminHits.map((hit) => `${hit.title} ${hit.distance.toFixed(3)}`).join(", ") || "none"}`,
    );
  }
  console.log(
    "Admin payroll search:",
    adminHits.map((hit) => `${hit.title} ${hit.distance.toFixed(3)}`).join(", "),
  );

  await prisma.team.deleteMany({ where: { name: "Other studio" } });
  const otherTeam = await prisma.team.create({ data: { name: "Other studio" } });
  const otherDocument = await prisma.document.create({
    data: {
      teamId: otherTeam.id,
      title: "Oak Street reserve",
      visibility: "admins",
      text: "The other studio keeps a private severance reserve of $77,000 for the Oak Street office.",
    },
  });
  await ingestDocument(otherDocument.id);
  const otherChunk = await prisma.chunk.findFirstOrThrow({
    where: { documentId: otherDocument.id },
  });
  const [otherVector] = await embed([otherChunk.text], "query");
  const otherLiteral = toVectorLiteral(otherVector);
  for (const person of [member, admin]) {
    const hits = await searchChunks(person.memberships, otherLiteral);
    if (hits.some((hit) => hit.id === otherChunk.id)) {
      throw new Error("A Demo user retrieved the other team's chunk.");
    }
  }
  const otherTeamDocument = await prisma.document.create({
    data: {
      teamId: otherTeam.id,
      title: "Oak Street handbook",
      visibility: "team",
      text: "The Oak Street office opens at 8.",
    },
  });
  const memberView = visibleDocumentsWhere(member.memberships[0]);
  const adminView = visibleDocumentsWhere(admin.memberships[0]);
  const memberAdminsDoc = await prisma.document.findFirst({
    where: { id: payroll.documentId, ...memberView },
  });
  if (memberAdminsDoc) {
    throw new Error("A member loaded an admins document by id.");
  }
  const memberOtherTeam = await prisma.document.findFirst({
    where: { id: otherTeamDocument.id, ...memberView },
  });
  if (memberOtherTeam) {
    throw new Error("A member loaded a document from another team.");
  }
  const adminAdminsDoc = await prisma.document.findFirst({
    where: { id: payroll.documentId, ...adminView },
  });
  if (!adminAdminsDoc) {
    throw new Error("An admin could not load an admins document on their team.");
  }
  console.log("Document visibility checks passed.");

  await prisma.team.delete({ where: { id: otherTeam.id } });
  console.log("Other team stayed hidden from Demo.");

  const [officeVector] = await embed(["When does the office open?"], "query");
  const officeHits = await searchChunks(
    member.memberships,
    toVectorLiteral(officeVector),
  );
  console.log(
    "Member office search:",
    officeHits.map((hit) => `${hit.title} ${hit.distance.toFixed(3)}`).join(", ") ||
      "none",
  );
  if (!officeHits.some((hit) => hit.id === handbook.id)) {
    throw new Error("Member did not retrieve the team handbook.");
  }

  const answered = await askQuestion(member.id, "When does the office open?");
  if (!answered.question.answer.trim()) {
    throw new Error("The model returned an empty answer.");
  }
  if (!answered.sources.some((source) => source.id === handbook.id)) {
    throw new Error("The saved answer did not cite the handbook.");
  }
  if (answered.sources.some((source) => source.id === payroll.id)) {
    throw new Error("The saved answer cited the payroll chunk.");
  }

  console.log("Answer:", answered.question.answer);
  console.log("Ask checks passed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
