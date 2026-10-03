import type { Prisma, Role } from "@prisma/client";

export function visibleDocumentsWhere(user: {
  teamId: string;
  role: Role;
}): Prisma.DocumentWhereInput {
  return {
    teamId: user.teamId,
    ...(user.role === "admin" ? {} : { visibility: "team" as const }),
  };
}
