"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ask, type AskState } from "./actions";

export function AskForm() {
  const [state, action, pending] = useActionState<AskState, FormData>(ask, null);

  return (
    <form action={action} className="flex flex-col gap-5" aria-busy={pending}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="question" className="text-sm">
          Question
        </Label>
        <Textarea
          id="question"
          name="question"
          required
          rows={4}
          placeholder="When does the office open?"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "question-error" : undefined}
          className="min-h-28 text-base md:text-base"
        />
        {state?.error ? (
          <p id="question-error" role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending} className="h-9 px-4 text-sm">
          {pending ? "Searching documents…" : "Ask"}
        </Button>
      </div>
    </form>
  );
}
