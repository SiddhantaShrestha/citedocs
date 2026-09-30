import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "citedocs";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: "admin@citedocs.test" },
    update: { passwordHash },
    create: { email: "admin@citedocs.test", passwordHash },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@citedocs.test" },
    update: { passwordHash },
    create: { email: "member@citedocs.test", passwordHash },
  });

  let team = await prisma.team.findFirst({ where: { name: "Demo" } });
  if (!team) {
    team = await prisma.team.create({ data: { name: "Demo" } });
  }

  await prisma.membership.upsert({
    where: { userId_teamId: { userId: admin.id, teamId: team.id } },
    update: { role: "admin" },
    create: { userId: admin.id, teamId: team.id, role: "admin" },
  });

  await prisma.membership.upsert({
    where: { userId_teamId: { userId: member.id, teamId: team.id } },
    update: { role: "member" },
    create: { userId: member.id, teamId: team.id, role: "member" },
  });

  console.log("Seeded Demo team.");
  console.log("admin@citedocs.test / citedocs");
  console.log("member@citedocs.test / citedocs");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
