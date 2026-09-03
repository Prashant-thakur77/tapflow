import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { getClient } from "../lib/ec";
import {
  COLLATERAL,
  ERC20_ABI,
  capRaw,
  gasWei,
  isLive,
  newSession,
  remainingMs as remaining,
  sessionWallet,
} from "../lib/ec";
import { useSessionStore } from "./sessionStore";

/**
 * One-tap session lifecycle: fund a capped session wallet from the owner (one
 * popup), then taps sign locally with no prompt. Sweeps funds back on end or
 * expiry. Returns the state + start/end the UI drives.
 */
export function useSession() {
  const { address } = useAccount();
  const { data: owner } = useWalletClient();
  const session = useSessionStore((s) => s.session);
  const setSession = useSessionStore((s) => s.setSession);
  const [busy, setBusy] = useState<"start" | "end" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sessionUsdc, setSessionUsdc] = useState<bigint | undefined>();

  const active = isLive(session) && !!address && session!.owner.toLowerCase() === address.toLowerCase();

  // 1s clock for the expiry countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Session-wallet tUSDC balance, so the UI can show remaining budget.
  useEffect(() => {
    let stop = false;
    const read = async () => {
      if (!session) {
        if (!stop) setSessionUsdc(undefined);
        return;
      }
      try {
        const bal = await getClient().getErc20Balance(COLLATERAL, session.address);
        if (!stop) setSessionUsdc(bal);
      } catch {
        /* transient */
      }
    };
    void read();
    const t = setInterval(read, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [session, active]);

  const sweep = useCallback(async (s = session) => {
    if (!s) return;
    const wallet = sessionWallet(s);
    const client = getClient().getViemClient();
    // tUSDC back to owner
    try {
      const bal = await getClient().getErc20Balance(COLLATERAL, s.address);
      if (bal > 0n) {
        await wallet.writeContract({ address: COLLATERAL, abi: ERC20_ABI, functionName: "transfer", args: [s.owner, bal] });
      }
    } catch {
      /* leave dust */
    }
    // STT back to owner minus a gas reserve
    try {
      const gas = await client.getBalance({ address: s.address });
      const reserve = 3_000_000_000_000_000n; // ~0.003 STT for the sweep tx
      if (gas > reserve) {
        await wallet.sendTransaction({ to: s.owner, value: gas - reserve });
      }
    } catch {
      /* leave dust */
    }
  }, [session]);

  const start = useCallback(
    async (capUsdc: number) => {
      if (!address || !owner) throw new Error("connect a wallet first");
      setBusy("start");
      try {
        const s = newSession(address, capUsdc);
        // One popup: fund the session wallet with tUSDC (cap) and STT (gas).
        await owner.writeContract({ address: COLLATERAL, abi: ERC20_ABI, functionName: "transfer", args: [s.address, capRaw(capUsdc)] });
        await owner.sendTransaction({ to: s.address, value: gasWei() });
        setSession(s);
        return s;
      } finally {
        setBusy(null);
      }
    },
    [address, owner, setSession],
  );

  const end = useCallback(async () => {
    setBusy("end");
    try {
      await sweep();
    } finally {
      setSession(null);
      setBusy(null);
    }
  }, [sweep, setSession]);

  // Auto-sweep on expiry (deferred so it never setStates synchronously in render).
  useEffect(() => {
    if (session && !isLive(session)) {
      const t = setTimeout(() => void end(), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, session]);

  return {
    session,
    active,
    busy,
    remainingMs: active ? remaining(session) : 0,
    sessionUsdc,
    start,
    end,
  };
}
