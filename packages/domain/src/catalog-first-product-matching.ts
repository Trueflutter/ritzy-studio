import type { RoomBundleRole } from "./catalog-first-room-generation";
import type { RoomProductRoleSpec } from "./product-matching";

export function catalogFirstRolesToProductMatchingSpecs(
  roles: readonly RoomBundleRole[]
): RoomProductRoleSpec[] {
  return roles.map((role) => ({
    category: role.category,
    label: role.label,
    visualBrief: null,
    quantity: role.quantity,
    priority: role.required ? "required" : "supporting"
  }));
}
