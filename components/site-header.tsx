import { RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/logout/actions";

export function SiteHeader({
  email,
  role,
  teamName,
}: {
  email: string;
  role: "admin" | "member";
  teamName: string | null;
}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4 lg:px-8">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight">CiteDocs</p>
          <p className="truncate text-sm text-muted-foreground">
            {teamName ? `${teamName} · ${email}` : email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RoleBadge role={role} />
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
