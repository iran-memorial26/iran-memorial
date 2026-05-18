import { prisma } from "../lib/db";

async function main() {
  const events = await prisma.event.findMany({
    where: { descriptionDe: { not: null } },
    select: { slug: true, descriptionDe: true },
    orderBy: { dateStart: "asc" },
  });

  console.log(JSON.stringify(events, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
