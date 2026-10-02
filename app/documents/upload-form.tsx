"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadDocument, type UploadState } from "./actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadDocument,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="file" className="text-sm">
          File
        </Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          required
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "upload-error" : undefined}
          className="h-10 text-sm md:text-sm"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="visibility" className="text-sm">
          Who can see it
        </Label>
        <select
          id="visibility"
          name="visibility"
          defaultValue="team"
          className="h-10 w-full border border-input bg-input/30 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
        >
          <option value="team">team</option>
          <option value="admins">admins</option>
        </select>
        {state?.error ? (
          <p id="upload-error" role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending} className="h-9 px-4 text-sm">
          {pending ? "Uploading..." : "Upload"}
        </Button>
        {pending ? (
          <p className="text-sm text-muted-foreground">Reading the file and saving chunks.</p>
        ) : null}
      </div>
    </form>
  );
}
