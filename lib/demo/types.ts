export type DemoRow = Record<string, unknown>;

export type DemoFilter =
  | { op: "eq"; col: string; val: unknown }
  | { op: "is"; col: string; val: null }
  | { op: "lt"; col: string; val: unknown }
  | { op: "gte"; col: string; val: unknown }
  | { op: "like"; col: string; val: string }
  | { op: "in"; col: string; val: unknown[] };

export type DemoQuery = {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  select?: string;
  head?: boolean;
  filters: DemoFilter[];
  order?: { col: string; ascending: boolean };
  limit?: number;
  single?: "single" | "maybe";
  values?: DemoRow | DemoRow[];
};

export type DemoResult = { data: unknown; error: { message: string; code?: string; hint?: string } | null; count?: number | null };

export type DemoEvent = {
  seq: number;
  table: string;
  type: "INSERT" | "UPDATE" | "DELETE";
  new: DemoRow;
  old: DemoRow;
};
