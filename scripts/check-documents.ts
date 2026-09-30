import { PrismaClient } from "@prisma/client";
import { extractText } from "unpdf";
import { listVisibleDocuments, readUpload, saveDocument } from "../lib/documents";

const prisma = new PrismaClient();

function tinyPdf(message: string) {
  const stream = `BT /F1 16 Tf 40 90 Td (${message}) Tj ET`;
  const objects = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n",
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n",
    `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(pdf);
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@citedocs.test" },
  });
  const member = await prisma.user.findUniqueOrThrow({
    where: { email: "member@citedocs.test" },
  });

  await prisma.document.deleteMany({
    where: { title: { in: ["Team handbook", "Payroll notes"] } },
  });

  const handbook = new File(["The office opens at 9."], "team-handbook.txt", {
    type: "text/plain",
  });
  await saveDocument({
    userId: admin.id,
    title: "Team handbook",
    visibility: "team",
    text: await readUpload(handbook),
  });

  const pdfBytes = tinyPdf("Admin only payroll notes");
  const { text } = await extractText(new Uint8Array(pdfBytes), { mergePages: true });
  if (!text.includes("payroll")) {
    throw new Error(`PDF text was not read: ${JSON.stringify(text)}`);
  }

  const payroll = new File([pdfBytes], "payroll-notes.pdf", {
    type: "application/pdf",
  });
  await saveDocument({
    userId: admin.id,
    title: "Payroll notes",
    visibility: "admins",
    text: await readUpload(payroll),
  });

  let memberBlocked = false;
  try {
    await saveDocument({
      userId: member.id,
      title: "Should fail",
      visibility: "team",
      text: "A member must not upload.",
    });
  } catch (error) {
    memberBlocked = error instanceof Error && error.message.includes("admin");
  }
  if (!memberBlocked) {
    throw new Error("A member was allowed to upload.");
  }

  const memberWithTeams = await prisma.user.findUniqueOrThrow({
    where: { email: "member@citedocs.test" },
    include: { memberships: true },
  });
  const visible = await listVisibleDocuments(memberWithTeams.memberships);
  const titles = visible.map((document) => document.title);
  if (titles.includes("Payroll notes") || !titles.includes("Team handbook")) {
    throw new Error(`Member saw the wrong documents: ${titles.join(", ")}`);
  }

  console.log("Upload checks passed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
