// The shape both paid pipelines partition their request by. Each route reserves
// a different set of stages, so the arithmetic of what a stage may take stays in
// its own module where it can be read; what is shared is the shape, because
// that is where the two copies had already diverged: one refused every stage
// below a floor, the other let a stage start with 400 ms and abandon it.

export function remainingMs(startedAt: number, now: number, runBudgetMs: number): number {
  return runBudgetMs - Math.max(0, now - startedAt);
}

// What a stage may take: its ceiling, or whatever the run can spare, or nothing
// at all. Below the floor a stage cannot finish, and starting one that cannot
// finish is worse than skipping it: a paid call spends its tokens and records
// no usage, and unpaid work spends the budget the stages after it need.
export function stageGuardMs({
  availableMs,
  maxMs,
  floorMs
}: {
  availableMs: number;
  maxMs: number;
  floorMs: number;
}): number | null {
  const timeout = Math.min(maxMs, availableMs);
  return timeout >= floorMs ? timeout : null;
}

// The provider deadline for a call guarded at guardMs. It sits under the
// service guard so the SDK aborts first and the guard is only a backstop.
export function providerDeadlineMs(guardMs: number, headroomMs: number): number {
  return Math.max(1_000, guardMs - headroomMs);
}
