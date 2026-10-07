import Link from "next/link";
import { VisibilityBadge } from "@/components/visibility-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AskResult } from "./actions";

function preview(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 220) return flat;
  return `${flat.slice(0, 220)}...`;
}

export function AnswerPanel({ result }: { result?: AskResult }) {
  if (!result) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-base text-foreground">No answer yet.</p>
          <p className="text-sm text-muted-foreground">
            Ask something that should be in the documents.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="text-base/relaxed [--card-spacing:--spacing(6)]">
        <CardHeader className="gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Question</p>
            <CardTitle className="font-sans text-base font-medium text-foreground">
              {result.question}
            </CardTitle>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm text-muted-foreground">Answer</h2>
            <p className="text-2xl leading-9 text-foreground">{result.answer}</p>
          </div>
        </CardHeader>
      </Card>
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">Sources</h2>
        {result.sources.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {result.sources.map((source) => (
              <li key={source.id}>
                <Link
                  href={`/documents/${source.documentId}?chunk=${source.id}`}
                  className="block"
                >
                  <Card className="text-base/relaxed [--card-spacing:--spacing(5)]">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="font-sans text-base">{source.title}</CardTitle>
                        <div className="flex shrink-0 items-center gap-2">
                          {source.visibility ? (
                            <VisibilityBadge visibility={source.visibility} />
                          ) : null}
                          <Badge variant="outline">Chunk {source.chunkNumber}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <blockquote className="border-l-2 border-accent pl-4 text-base leading-7 text-foreground">
                        {preview(source.text)}
                      </blockquote>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
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
  );
}
