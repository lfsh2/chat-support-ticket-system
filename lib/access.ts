import type { Database } from "@/lib/database.types";

type Membership = Pick<
  Database["public"]["Tables"]["memberships"]["Row"],
  "status" | "grace_until" | "program"
>;
type Role = Database["public"]["Enums"]["user_role"];
export type Program = Database["public"]["Enums"]["program"];

export const STAFF_ROLES: readonly Role[] = ["agent", "admin", "owner"];

export function isStaffRole(role: Role | null | undefined): boolean {
  return role != null && STAFF_ROLES.includes(role);
}

/** Mirrors public.has_program() in SQL: active, manual, or still inside a grace period. */
export function membershipGrantsAccess(m: Membership, now: Date = new Date()): boolean {
  if (m.status === "active" || m.status === "manual") return true;
  return m.grace_until != null && new Date(m.grace_until) > now;
}

export function activePrograms(memberships: Membership[], now: Date = new Date()): Program[] {
  return [...new Set(memberships.filter((m) => membershipGrantsAccess(m, now)).map((m) => m.program))];
}

/** Whether an email may receive a sign-in link: staff, or at least one live membership. */
export function canSignIn(
  memberships: Membership[],
  role: Role | null | undefined,
  now: Date = new Date(),
): boolean {
  return isStaffRole(role) || activePrograms(memberships, now).length > 0;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
