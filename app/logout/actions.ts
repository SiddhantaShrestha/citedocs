"use server";

import { redirect } from "next/navigation";
import { deleteCurrentSession } from "@/lib/session";

export async function logout() {
  await deleteCurrentSession();
  redirect("/login");
}
