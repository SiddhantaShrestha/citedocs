import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { VisibilityBadge } from "@/components/visibility-badge";
import { prisma } from "@/lib/db";
import { visibleDocumentsWhere } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chunk?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { chunk } = await searchParams;
  const chunkId = Array.isArray(chunk) ? chunk[0] : chunk;
  const access = user.memberships.map((membership) => visibleDocumentsWhere(membership));
  if (access.length === 0) notFound();

  const document = await prisma.document.findFirst({
    where: {
      id,
      OR: access,
    },
  });
  if (!document) notFound();

  const cited = chunkId
    ? await prisma.chunk.findFirst({
        where: { id: chunkId, documentId: document.id },
      })
    : null;

  const isAdmin = user.memberships.some((membership) => membership.role === "admin");

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        email={user.email}
        role={isAdmin ? "admin" : "member"}
        teamName={user.memberships[0]?.team.name ?? null}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <Link href="/" className="text-sm text-muted-foreground">
          Back
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{document.title}</h1>
          <VisibilityBadge visibility={document.visibility} />
        </div>
        {cited ? (
          <blockquote className="border-l-2 border-accent pl-4">
            <p className="text-sm text-muted-foreground">
              Cited passage (chunk {cited.position + 1})
            </p>
            <p
              className="mt-2 text-base leading-7 text-foreground"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {cited.text}
            </p>
          </blockquote>
        ) : null}
        <p className="text-base leading-7 text-foreground" style={{ whiteSpace: "pre-wrap" }}>
          {document.text}
        </p>
      </main>
    </div>
  );
}
