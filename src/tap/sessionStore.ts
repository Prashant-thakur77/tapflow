import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session } from "../lib/ec";

interface SessionState {
  session: Session | null;
  setSession: (s: Session | null) => void;
}

/**
 * The active session wallet, persisted so one-tap survives a reload within the
 * 30-minute window. Testnet only: the key sits in localStorage, capped and
 * auto-swept — never use this pattern for mainnet funds.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
    }),
    { name: "tapflow-session" },
  ),
);
