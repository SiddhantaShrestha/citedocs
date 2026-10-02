import { Badge } from "@/components/ui/badge";

export function RoleBadge({ role }: { role: "admin" | "member" }) {
  if (role === "admin") {
    return (
      <Badge className="border-accent/40 bg-accent/15 text-accent">
        admin
      </Badge>
    );
  }

  return <Badge variant="secondary">member</Badge>;
}
