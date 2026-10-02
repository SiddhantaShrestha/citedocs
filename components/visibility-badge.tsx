import { Badge } from "@/components/ui/badge";

export function VisibilityBadge({ visibility }: { visibility: "team" | "admins" }) {
  if (visibility === "admins") {
    return (
      <Badge variant="outline" className="border-accent/50 text-accent">
        admins
      </Badge>
    );
  }

  return <Badge variant="secondary">team</Badge>;
}
