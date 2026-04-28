export const PRIORITY_LANES = [
  "urgent-input",
  "visible-projection",
  "stream-update",
  "background-indexing"
] as const;

export type PriorityLane = (typeof PRIORITY_LANES)[number];

export const PRIORITY_ORDER: Record<PriorityLane, number> = {
  "urgent-input": 4,
  "visible-projection": 3,
  "stream-update": 2,
  "background-indexing": 1
} as const;

export function isPriorityLane(value: unknown): value is PriorityLane {
  return typeof value === "string" && value in PRIORITY_ORDER;
}

export function comparePriority(a: PriorityLane, b: PriorityLane): number {
  return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
}

export function isPreemptibleBy(current: PriorityLane, incoming: PriorityLane): boolean {
  return comparePriority(incoming, current) > 0;
}
