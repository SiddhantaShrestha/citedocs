import { Visibility, type Role } from "@prisma/client";
import { extractText } from "unpdf";
import { prisma } from "@/lib/db";

const MAX_BYTES = 8 * 1024 * 1024;

export function isVisibility(value: string): value is Visibility {
  return value === "team" || value === "admins";
}

export async function readUpload(file: File) {
  if (file.size === 0) {
    throw new Error("Choose a file.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large. Max is 8 MB.");
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return file.text();
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const data = new Uint8Array(await file.arrayBuffer());
    const { text } = await extractText(data, { mergePages: true });
    return text;
  }

  throw new Error("Upload a .txt or .pdf file.");
}

export async function saveDocument(input: {
  userId: string;
  title: string;
  visibility: Visibility;
  text: string;
}) {
  const membership = await prisma.membership.findFirst({
    where: { userId: input.userId, role: "admin" },
  });
  if (!membership) {
    throw new Error("Only an admin can upload documents.");
  }

  const text = input.text.trim();
  if (!text) {
    throw new Error("This file has no text.");
  }

  const title = input.title.trim() || "Untitled";

  return prisma.document.create({
    data: {
      teamId: membership.teamId,
      title,
      visibility: input.visibility,
      text,
    },
  });
}

export async function listVisibleDocuments(
  memberships: { teamId: string; role: Role }[],
) {
  if (memberships.length === 0) return [];

  return prisma.document.findMany({
    where: {
      OR: memberships.map((membership) => ({
        teamId: membership.teamId,
        ...(membership.role === "member" ? { visibility: "team" as const } : {}),
      })),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      visibility: true,
      text: true,
      createdAt: true,
    },
  });
}
