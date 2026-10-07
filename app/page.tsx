import Link from "next/link";
import { redirect } from "next/navigation";
import { AskForm } from "@/app/ask/ask-form";
import { UploadForm } from "@/app/documents/upload-form";
import { SiteHeader } from "@/components/site-header";
import { VisibilityBadge } from "@/components/visibility-badge";
import { Card, CardContent } from "@/components/ui/card";
import { isDemoReadonly } from "@/lib/demo";
import { listVisibleDocuments } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.memberships.some((membership) => membership.role === "admin");
  const canUpload = isAdmin && !isDemoReadonly();
  const documents = await listVisibleDocuments(user.memberships);
  const teamName = user.memberships[0]?.team.name ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        email={user.email}
        role={isAdmin ? "admin" : "member"}
        teamName={teamName}
      />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-14 px-6 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:gap-16 lg:px-8 lg:py-12">
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
            <p className="max-w-prose text-base text-muted-foreground">
              Answers come only from documents you are allowed to see.
            </p>
          </div>
          <AskForm />
        </section>

        <section className="flex flex-col gap-6 lg:sticky lg:top-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
            <p className="text-base text-muted-foreground">
              {isAdmin
                ? "Team files are visible to everyone. Admin-only files stay with admins."
                : "You can see team files. Admin-only files stay hidden."}
            </p>
          </div>
          {documents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-base text-foreground">No documents yet.</p>
                <p className="text-sm text-muted-foreground">
                  {canUpload
                    ? "Upload a text file or PDF to start."
                    : "An admin has not shared a file you can see."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto border border-border bg-card">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/documents/${document.id}`}
                      className="block truncate text-sm font-medium"
                    >
                      {document.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {document._count.chunks === 1
                        ? "1 chunk"
                        : `${document._count.chunks} chunks`}
                    </p>
                  </div>
                  <VisibilityBadge visibility={document.visibility} />
                </li>
              ))}
            </ul>
          )}
          {canUpload ? (
            <div className="flex flex-col gap-5 border border-border bg-card px-5 py-5">
              <h3 className="text-base font-semibold">Upload</h3>
              <UploadForm />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
