// TapFlow indexer: Somnia Shannon fills → SQLite → leaderboard / stats / feed / share cards.
import { POLL_MS } from "./config.js";
import { log, syncOnce } from "./chain.js";
import { startApi } from "./api.js";

startApi();
log(`indexer: polling every ${POLL_MS / 1000}s`);
void syncOnce();
setInterval(() => void syncOnce(), POLL_MS);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
