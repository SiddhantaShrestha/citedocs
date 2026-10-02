"use server";

import { redirect } from "next/navigation";
import { askQuestion } from "@/lib/ask";
import { getCurrentUser } from "@/lib/session";

export type AskState = { error: string } | null;

export async function ask(
  _prev: AskState,
  formData: FormData,
): Promise<AskState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    await askQuestion(user.id, String(formData.get("question") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not answer.";
    return { error: message };
  }

  redirect("/");
}
