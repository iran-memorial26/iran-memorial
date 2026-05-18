import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { AdminPanel } from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [pending, approved, rejected] = await Promise.all([
    prisma.submission.count({ where: { status: "pending" } }),
    prisma.submission.count({ where: { status: "approved" } }),
    prisma.submission.count({ where: { status: "rejected" } }),
  ]);

  const submissions = await prisma.submission.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AdminPanel
      submissions={JSON.parse(JSON.stringify(submissions))}
      counts={{ pending, approved, rejected }}
    />
  );
}
