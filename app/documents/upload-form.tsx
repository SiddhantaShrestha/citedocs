"use client";

import { useActionState } from "react";
import { uploadDocument, type UploadState } from "./actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadDocument,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        File
        <input
          name="file"
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          required
          className="text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Who can see it
        <select
          name="visibility"
          defaultValue="team"
          className="rounded-md border border-zinc-300 px-3 py-2"
        >
          <option value="team">Everyone on the team</option>
          <option value="admins">Admins only</option>
        </select>
      </label>
      {state?.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
