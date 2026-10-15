import type { User } from "@/types/user";

export function isDeveloperOrTester(user: Pick<User, "role_names">): boolean {
  return isDeveloperOrTesterRoleNames(user.role_names ?? []);
}

export function isDeveloperOrTesterRoleNames(_roles: string[]): boolean {
  // Team membership and task assignment are data relationships, not role-name
  // conventions. Any workspace user may fill either relationship.
  return true;
}

export function isTeamLeadOnly(user: Pick<User, "role_names">): boolean {
  return isTeamLeadOnlyRoleNames(user.role_names ?? []);
}

export function isTeamLeadOnlyRoleNames(_roles: string[]): boolean {
  return true;
}

export function visibleMemberPost(user: Pick<User, "role_names">): string {
  return visibleMemberPostForRoleNames(user.role_names ?? []);
}

export function visibleMemberPostForRoleNames(roles: string[]): string {
  return roles.join(", ") || "Member";
}
