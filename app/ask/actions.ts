"use server";

import { redirect } from "next/navigation";
import { cleanAnswer } from "@/lib/answer";
import { askQuestion } from "@/lib/ask";
import { splitChunks } from "@/lib/chunk";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export type AskedSource = {
  id: string;
  documentId: string;
  title: string;
  text: string;
  visibility: "team" | "admins" | null;
  chunkNumber: number;
};

export type AskResult = {
  question: string;
  answer: string;
  sources: AskedSource[];
};

export type AskState = {
  error?: string;
  result?: AskResult;
} | null;

export async function ask(_prev: AskState, formData: FormData): Promise<AskState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    const saved = await askQuestion(user.id, String(formData.get("question") ?? ""));
    const sources = saved.sources.filter(
      (source): source is NonNullable<(typeof saved.sources)[number]> => source != null,
    );
    const documents = sources.length
      ? await prisma.document.findMany({
          where: { id: { in: sources.map((source) => source.documentId) } },
          select: { id: true, text: true, visibility: true },
        })
      : [];
    const byId = new Map(documents.map((document) => [document.id, document]));

    return {
      result: {
        question: saved.question.question,
        answer: cleanAnswer(saved.question.answer),
        sources: sources.map((source, index) => {
          const document = byId.get(source.documentId);
          const flat = source.text.replace(/\s+/g, " ").trim();
          const chunkIndex = document
            ? splitChunks(document.text).findIndex((chunk) => chunk === flat)
            : -1;
          return {
            id: source.id,
            documentId: source.documentId,
            title: source.title,
            text: source.text,
            visibility: document?.visibility ?? null,
            chunkNumber: chunkIndex >= 0 ? chunkIndex + 1 : index + 1,
          };
        }),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not answer.";
    return { error: message, result: _prev?.result };
  }
}
