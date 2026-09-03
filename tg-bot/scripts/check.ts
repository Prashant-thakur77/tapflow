// Offline + read-only check:
//   1. the bot constructs with a fake token (no network),
//   2. the /window data path reads a real live window from Shannon.
//   npm run check
import { createBot, COMMANDS } from "../src/bot.js";
import { describeWindow } from "../src/handlers.js";

const bot = createBot("123456:FAKE-TOKEN-FOR-CONSTRUCTION-CHECK");
console.log(`bot constructed · ${COMMANDS.length} commands registered · handlers wired`);
void bot;

const t0 = Date.now();
const { text, w } = await describeWindow({ asset: "BTC", intervalSec: 300 });
console.log(`\n/window BTC 5m (${Date.now() - t0}ms)${w ? ` · marketId ${w.marketId}` : ""}\n`);
console.log(text.replace(/<[^>]+>/g, ""));
process.exit(0);
