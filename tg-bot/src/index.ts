// TapFlow Telegram bot — long polling.
//   BOT_TOKEN=… npm start
import { assertBotToken, config } from "./config.js";
import { canTrade, getExchange } from "./ec.js";
import { COMMANDS, createBot } from "./bot.js";

assertBotToken();
const bot = createBot(config.botToken);

await bot.api.setMyCommands(COMMANDS);
console.log(`tapflow bot · chain ${config.chainId} · api ${config.tapflowApi} · webapp ${config.webappUrl}`);
console.log(canTrade() ? `trading wallet ${getExchange().walletAddress}` : "read-only (BOT_PRIVATE_KEY unset) — /up and /down point users to the mini-app");

const stop = () => {
  console.log("stopping…");
  void bot.stop();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await bot.start({ onStart: (me) => console.log(`@${me.username} is live`) });
