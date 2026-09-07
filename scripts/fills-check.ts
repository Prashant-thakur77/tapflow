// Diagnose: does the Somnia indexer list our wallet's fills? (read-only)
import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { getClient } from "../src/lib/ec";
const me = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`).address;
const c = getClient();
const POOL = "0x06B0C35e61c7cEF10689B48500fC374867e33df4"; const MARKET = "0x0000000000000000000000000000000000000000000000000000000000015779";
const pool = await c.getFills(POOL, { since: 1788700000, until: Math.floor(Date.now()/1000), limit: 200, offset: 0 });
const ours = pool.filter((f) => [f.taker, f.takerOrder?.owner, f.maker].some((a) => a?.toLowerCase() === me.toLowerCase()));
console.log(`getFills(pool) 200 newest: ${pool.length} rows, ours: ${ours.length}; markets in page: ${[...new Set(pool.map((f) => String(f.market).slice(-6)))].join(",")}`);
for (const f of ours.slice(0, 3)) console.log("  ours:", { market: f.market, taker: f.taker, takerSide: f.takerSide, owner: f.takerOrder?.owner, side: f.takerOrder?.side, kind: f.kind, tx: f.txHash.slice(0, 10) });
const first = pool.at(-1), last = pool[0]; console.log("page ts range:", first?.timestamp, "→", last?.timestamp, "(now", Math.floor(Date.now()/1000), ")");
process.exit(0);
