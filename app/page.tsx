import { redirect } from "next/navigation";
import { AskForm } from "@/app/ask/ask-form";
import { UploadForm } from "@/app/documents/upload-form";
import { SiteHeader } from "@/components/site-header";
import { VisibilityBadge } from "@/components/visibility-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanAnswer } from "@/lib/answer";
import { latestAnswer } from "@/lib/ask";
import { splitChunks } from "@/lib/chunk";
import { listVisibleDocuments } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

function preview(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 220) return flat;
  return `${flat.slice(0, 220)}...`;
}

function orderedSources<T extends { id: string }>(sources: T[], chunkIds: string[]) {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const ordered = chunkIds
    .map((id) => byId.get(id))
    .filter((source): source is T => source != null);

  for (const source of sources) {
    if (!ordered.some((item) => item.id === source.id)) ordered.push(source);
  }

  return ordered;
}

function sourceDetails(
  source: { text: string; title: string },
  documents: { title: string; text: string; visibility: "team" | "admins" }[],
  fallback: number,
) {
  const flat = source.text.replace(/\s+/g, " ").trim();
  const document =
    documents.find((item) => {
      if (item.title !== source.title) return false;
      return splitChunks(item.text).some((chunk) => chunk === flat);
    }) ?? documents.find((item) => item.title === source.title);

  const index = document
    ? splitChunks(document.text).findIndex((chunk) => chunk === flat)
    : -1;

  return {
    visibility: document?.visibility ?? null,
    chunkNumber: index >= 0 ? index + 1 : fallback,
  };
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.memberships.some((membership) => membership.role === "admin");
  const documents = await listVisibleDocuments(user.memberships);
  const latest = await latestAnswer(user.id);
  const teamName = user.memberships[0]?.team.name ?? null;
  const sources = latest
    ? orderedSources(latest.sources, latest.question.chunkIds)
    : [];

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
          {latest ? (
            <div className="flex flex-col gap-6">
              <Card className="text-base/relaxed [--card-spacing:--spacing(6)]">
                <CardHeader className="gap-5">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">Question</p>
                    <CardTitle className="font-sans text-base font-medium text-foreground">
                      {latest.question.question}
                    </CardTitle>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="text-sm text-muted-foreground">Answer</h2>
                    <p className="text-2xl leading-9 text-foreground">
                      {cleanAnswer(latest.question.answer)}
                    </p>
                  </div>
                </CardHeader>
              </Card>
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-medium text-muted-foreground">Sources</h2>
                {sources.length > 0 ? (
                  <ul className="flex flex-col gap-4">
                    {sources.map((source, index) => {
                      const details = sourceDetails(source, documents, index + 1);
                      return (
                        <li key={source.id}>
                          <Card className="text-base/relaxed [--card-spacing:--spacing(5)]">
                            <CardHeader>
                              <div className="flex items-start justify-between gap-4">
                                <CardTitle className="font-sans text-base">
                                  {source.title}
                                </CardTitle>
                                <div className="flex shrink-0 items-center gap-2">
                                  {details.visibility ? (
                                    <VisibilityBadge visibility={details.visibility} />
                                  ) : null}
                                  <Badge variant="outline">Chunk {details.chunkNumber}</Badge>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <blockquote className="border-l-2 border-accent pl-4 text-base leading-7 text-foreground">
                                {preview(source.text)}
                              </blockquote>
                            </CardContent>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Card>
                    <CardContent>
                      <p className="text-base text-foreground">No passage matched this question.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-1">
                <p className="text-base text-foreground">No answer yet.</p>
                <p className="text-sm text-muted-foreground">
                  Ask something that should be in the documents.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-8">
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
                  {isAdmin
                    ? "Upload a text file or PDF to start."
                    : "An admin has not shared a file you can see."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="flex flex-col gap-4">
              {documents.map((document) => (
                <li key={document.id}>
                  <Card className="text-base/relaxed [--card-spacing:--spacing(5)]">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="font-sans text-base">{document.title}</CardTitle>
                        <VisibilityBadge visibility={document.visibility} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {document._count.chunks} chunk
                        {document._count.chunks === 1 ? "" : "s"}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base leading-7 text-foreground">
                        {preview(document.text)}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {isAdmin ? (
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
