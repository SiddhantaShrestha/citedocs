import { PrismaClient } from "@prisma/client";
import { askQuestion } from "../lib/ask";
import { embedTexts, toVectorLiteral } from "../lib/embed";
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

  const [payrollVector] = await embedTexts([payroll.text], "query");
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
      `Admin missed the payroll chunk: ${adminHits.map((hit) => `${hit.title} ${hit.distance.toFixed(3)}`).join(", ")}`,
    );
  }

  const [officeVector] = await embedTexts(["When does the office open?"], "query");
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
