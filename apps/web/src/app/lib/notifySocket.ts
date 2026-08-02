// ─── TUBA AL HIJAZ · Notifications live socket (Socket.io) ───────────────────
// Shared connection to `/notifications`. Mirrors opsSocket.ts patterns.
// S2-02: handshake sends access JWT via auth.token; server joins user/tenant
// rooms from the JWT only (query userId/tenantId no longer trusted).

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const API_URL: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://127.0.0.1:3210";

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

/** Shared `/notifications` socket (JWT on handshake, auto-reconnect). */
export function notifySocket(): Socket {
  if (!sock) {
    const { url, path } = socketTarget("/notifications");
    sock = io(url, {
      path,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000,
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
 * Subscribe to in-app `notification` events. `onReconnect` re-fetches the bell
 * after a drop→reconnect (same pattern as useOpsEvents).
 */
export function useNotifyEvents(
  onNotification?: Handler,
  onReconnect?: () => void,
): boolean {
  const [connected, setConnected] = useState(false);
  const notifRef = useRef(onNotification);
  notifRef.current = onNotification;
  const reconnectRef = useRef(onReconnect);
  reconnectRef.current = onReconnect;

  useEffect(() => {
    if (!getAccessToken()) return;
    const s = notifySocket();
    let everConnected = s.connected;
    setConnected(s.connected);

    const onConnect = () => {
      setConnected(true);
      if (everConnected) reconnectRef.current?.();
      everConnected = true;
    };
    const onDisconnect = () => setConnected(false);
    const onNotif: Handler = (p) => notifRef.current?.(p);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("notification", onNotif);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("notification", onNotif);
    };
  }, []);

  return connected;
}
