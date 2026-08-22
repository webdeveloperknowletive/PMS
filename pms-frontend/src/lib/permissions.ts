/**
 * There's no real permissions system in the schema (roles table only has
 * role_name + description, no permission flags). This is a heuristic:
 * any role whose name contains "admin" is treated as an admin role.
 * Rename your admin role to something without "admin" in it and this
 * silently stops working — that's the honest trade-off of not having a
 * real is_admin/permission column on the backend.
 */
export function isAdminRoleName(roleName: string): boolean {
  return roleName.toLowerCase().includes("admin");
}