import type { ReactNode } from "react";

export type Row = Record<string, unknown>;

export interface Column {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
}
