// Tiny per-chat state, in memory. Lost on restart — that is fine for a bot
// whose every real action is a transaction you can read back from chain.
import type { Asset } from "./ec.js";

export interface ChatState {
  asset: Asset;
  intervalSec: number;
  /** The user's own wallet, set with /wallet <address>, used for /follow. */
  wallet?: `0x${string}`;
}

const chats = new Map<number, ChatState>();

export function stateOf(chatId: number): ChatState {
  let s = chats.get(chatId);
  if (!s) {
    s = { asset: "BTC", intervalSec: 300 };
    chats.set(chatId, s);
  }
  return s;
}
