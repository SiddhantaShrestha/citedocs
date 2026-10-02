import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm border-t-2 border-t-accent text-base/relaxed [--card-spacing:--spacing(6)]">
        <CardHeader className="gap-2">
          <p className="text-sm text-muted-foreground">CiteDocs</p>
          <CardTitle className="font-sans text-2xl">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Demo password is citedocs. Use admin@citedocs.test or
            member@citedocs.test.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
