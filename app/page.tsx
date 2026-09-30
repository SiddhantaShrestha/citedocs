import { redirect } from "next/navigation";
import { UploadForm } from "@/app/documents/upload-form";
import { logout } from "@/app/logout/actions";
import { listVisibleDocuments } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

function preview(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 140) return flat;
  return `${flat.slice(0, 140)}...`;
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.memberships.some((membership) => membership.role === "admin");
  const documents = await listVisibleDocuments(user.memberships);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">CiteDocs</p>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {user.email}
            {user.memberships.map((membership) => (
              <span key={membership.id}>
                {`, ${membership.team.name} (${membership.role})`}
              </span>
            ))}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-3">
        {documents.length === 0 ? (
          <p className="text-sm text-zinc-500">No documents yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((document) => (
              <li key={document.id} className="rounded-md border border-zinc-200 p-3">
                <p className="font-medium">{document.title}</p>
                <p className="text-xs text-zinc-500">
                  {document.visibility === "admins" ? "Admins only" : "Everyone on the team"}
                </p>
                <p className="mt-2 text-sm text-zinc-700">{preview(document.text)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Upload</h2>
          <UploadForm />
        </section>
      ) : null}
    </main>
  );
}
