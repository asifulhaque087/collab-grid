import type { User, Role } from "@/types";

const users: User[] = [
  { id: "u1", name: "Rafiq Khan", email: "rafiq.khan@aarong.com", role: "Retail Manager", status: "active", joined: "May 12" },
  { id: "u2", name: "Sharmin Akhter", email: "sharmin.akhter@aarong.com", role: "Inventory Clerk", status: "active", joined: "May 18" },
  { id: "u3", name: "Nadia Karim", email: "nadia.karim@aarong.com", role: "Retail Manager", status: "inactive", joined: "Jun 01" },
];

const roles: Role[] = [
  { id: "r1", name: "Tenant Admin", members: 1, permissions: "Full access", createdBy: "constant", createdByKind: "system", created: "Auto", system: true },
  { id: "r2", name: "Retail Manager", members: 2, permissions: "Boards, Inventory, Orders", createdBy: "admin", createdByKind: "pill", created: "May 14", system: false },
  { id: "r3", name: "Inventory Clerk", members: 1, permissions: "Inventory", createdBy: "tenant", createdByKind: "pill", created: "May 20", system: false },
];

export async function getUsers(): Promise<User[]> {
  return users;
}

export async function getRoles(): Promise<Role[]> {
  return roles;
}
