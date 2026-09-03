// The completeness rule, in one place and free of any server import so it can
// be asserted directly. A role the app did not choose FOR the shopper (nothing
// was confirmed to match the design) is not a gap in the catalogue and is not
// a choice already made: it is a choice still to make. It must not be counted
// as chosen, it must keep the final render gated, and the screens must say how
// many there are rather than presenting the list as complete.

export function chosenRoleCount(
  groups: ReadonlyArray<{ roleKey: string }>,
  selectedByRole: ReadonlyMap<string, string>
): number {
  return groups.filter((group) => selectedByRole.has(group.roleKey)).length;
}

export function allRolesChosen(
  groups: ReadonlyArray<{ roleKey: string }>,
  selectedByRole: ReadonlyMap<string, string>
): boolean {
  return groups.every((group) => selectedByRole.has(group.roleKey));
}

export function rolesAwaitingChoice(
  groups: ReadonlyArray<{ options: ReadonlyArray<{ status: string }> }>
): number {
  return groups.filter((group) => !group.options.some((option) => option.status === "selected")).length;
}

export function awaitingChoiceCaveat(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return count === 1 ? "1 piece needs your choice." : `${count} pieces need your choice.`;
}
