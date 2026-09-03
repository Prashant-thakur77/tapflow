import type { Row } from "./types";

export function bpsToPercent(bps: number | undefined): string {
  if (bps == null) return "-";
  return `${(bps / 100).toFixed(2)}%`;
}

export function shortHash(hash: string | undefined): string {
  if (!hash) return "-";
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function fmt(n: number | string | undefined): string {
  if (n == null) return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString();
}

export function safeRows(payload: unknown): Row[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Row[];

  const maybeData = payload as { data?: unknown };
  if (Array.isArray(maybeData.data)) return maybeData.data as Row[];
  return [];
}

const now = Math.floor(Date.now() / 1000);
const sevenDaysAgo = now - 7 * 24 * 60 * 60;

export const DEFAULT_PARAMS = {
  fromTimestamp: sevenDaysAgo,
  toTimestamp: now,
  pageSize: 10,
  page: 1,
};
