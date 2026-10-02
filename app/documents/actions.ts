"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isVisibility, readUpload, saveDocument } from "@/lib/documents";
import { ingestDocument } from "@/lib/ingest";
import { getCurrentUser } from "@/lib/session";

export type UploadState = { error: string } | null;

export async function uploadDocument(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const file = formData.get("file");
  const visibility = String(formData.get("visibility") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file." };
  }
  if (!isVisibility(visibility)) {
    return { error: "Choose who can see this document." };
  }

  try {
    const text = await readUpload(file);
    const title = file.name.replace(/\.[^.]+$/, "");
    const document = await saveDocument({
      userId: user.id,
      title,
      visibility,
      text,
    });
    try {
      await ingestDocument(document.id);
    } catch (error) {
      await prisma.document.delete({ where: { id: document.id } });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return { error: message };
  }

  redirect("/");
}
