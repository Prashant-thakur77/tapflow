// Bot factory — builds the grammY bot without starting it, so it can be
// constructed in tests/checks with a fake token.
import { Bot, GrammyError, HttpError, type BotError } from "grammy";
import { handleBoard, handleCallback, handleFollow, handleStart, handleTap, handleWallet, handleWindow, parseAmount } from "./handlers.js";

const args = (text: string | undefined) => (text ?? "").trim().split(/\s+/).slice(1);

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command(["start", "help"], (ctx) => handleStart(ctx));
  bot.command("window", (ctx) => handleWindow(ctx, args(ctx.message?.text)));
  bot.command("up", (ctx) => handleTap(ctx, "UP", parseAmount(args(ctx.message?.text)[0], 1)));
  bot.command("down", (ctx) => handleTap(ctx, "DOWN", parseAmount(args(ctx.message?.text)[0], 1)));
  bot.command("follow", (ctx) => handleFollow(ctx, args(ctx.message?.text)[0]));
  bot.command("wallet", (ctx) => handleWallet(ctx, args(ctx.message?.text)[0]));
  bot.command("board", (ctx) => handleBoard(ctx));

  bot.on("callback_query:data", async (ctx) => {
    try {
      await handleCallback(ctx, ctx.callbackQuery.data);
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.error(`callback error [${ctx.callbackQuery.data}]:`, err);
      await ctx.answerCallbackQuery({ text: "Something went wrong." }).catch(() => undefined);
    }
  });

  bot.on("message:text", (ctx) => ctx.reply("Try /window, /up 5, /down 5, /follow <address> or /board."));

  bot.catch((err: BotError) => {
    const { ctx, error } = err;
    const where = `chat=${ctx.chat?.id ?? "?"} update=${ctx.update.update_id}`;
    if (error instanceof GrammyError) console.error(`grammy [${where}]`, error.description);
    else if (error instanceof HttpError) console.error(`http [${where}]`, error.message);
    else console.error(`error [${where}]`, error);
  });

  return bot;
}

export const COMMANDS = [
  { command: "window", description: "Live window + odds (e.g. /window ETH 15m)" },
  { command: "up", description: "Tap UP with the bot wallet (e.g. /up 5)" },
  { command: "down", description: "Tap DOWN with the bot wallet (e.g. /down 5)" },
  { command: "follow", description: "Follow a leader: /follow 0x…" },
  { command: "board", description: "Top tappers" },
  { command: "wallet", description: "Save your wallet for /follow" },
  { command: "help", description: "How TapFlow works" },
];
