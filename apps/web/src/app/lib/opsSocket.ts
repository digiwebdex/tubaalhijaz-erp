// ─── TUBA AL HIJAZ · Ops live socket (Socket.io) ─────────────────────────────
// A single shared connection to the /ops namespace for the OpsControl boards.
// S1-03: handshake sends the access JWT (auth.token). Server requires
// VIEW_DASHBOARD and rejects tenant (agent/supplier) JWTs.
// socket.io-client reconnects automatically after a drop; `useOpsEvents` also
// re-runs `onReconnect` after each reconnect so the board re-fetches anything
// it missed while offline.

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const API_URL: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://127.0.0.1:3210";

// Split VITE_API_URL into origin + base path so socket.io works both directly
// (dev: http://127.0.0.1:3210 → path /socket.io) AND behind a reverse-proxy
// prefix (prod: https://host/api → connect origin https://host, engine.io path
// /api/socket.io which nginx strips back to /socket.io at the api container).
function socketTarget(namespace: string): { url: string; path: string } {
  try {
    const u = new URL(API_URL, typeof window !== "undefined" ? window.location.origin : undefined);
    const base = u.pathname.replace(/\/$/, "");
    return { url: `${u.origin}${namespace}`, path: `${base}/socket.io` };
  } catch {
    return { url: `${API_URL}${namespace}`, path: "/socket.io" };
  }
}

let sock: Socket | null = null;

/** The shared /ops socket (lazily created, auto-reconnecting, JWT on handshake). */
export function opsSocket(): Socket {
  if (!sock) {
    const { url, path } = socketTarget("/ops");
    sock = io(url, {
      path,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000,
      // Fresh token on every (re)connect — required by OpsGateway (S1-03).
      auth: (cb: (data: { token?: string }) => void) => {
        const token = getAccessToken();
        cb(token ? { token } : {});
      },
    });
  } else {
    const token = getAccessToken();
    sock.auth = token ? { token } : {};
  }
  return sock;
}

type Handler = (payload: unknown) => void;

/**
 * Subscribe to /ops broadcast events. Returns the live connection state (drive a
 * LIVE / reconnecting indicator from it). `onReconnect` fires after a
 * drop→reconnect (not on the first connect) so callers can re-fetch the board.
 * Handlers/onReconnect are read through refs, so the effect binds exactly once.
 */
export function useOpsEvents(handlers: Record<string, Handler>, onReconnect?: () => void): boolean {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const reconnectRef = useRef(onReconnect);
  reconnectRef.current = onReconnect;

  useEffect(() => {
    const s = opsSocket();
    let everConnected = s.connected;
    setConnected(s.connected);

    const onConnect = () => {
      setConnected(true);
      if (everConnected) reconnectRef.current?.(); // reconnect, not first connect
      everConnected = true;
    };
    const onDisconnect = () => setConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    // one stable wrapper per event that dispatches through the live ref
    const wrapped: Record<string, Handler> = {};
    for (const ev of Object.keys(handlersRef.current)) {
      const w: Handler = (p) => handlersRef.current[ev]?.(p);
      wrapped[ev] = w;
      s.on(ev, w);
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      for (const ev of Object.keys(wrapped)) s.off(ev, wrapped[ev]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return connected;
}
