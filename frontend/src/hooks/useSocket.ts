"use client";

import { useCallback, useContext } from "react";
import { SocketContext } from "@/components/providers/socket-provider";

/**
 * useSocket
 *
 * Thin wrapper around the global SocketProvider context.
 * Returns the shared socket instance, connection state, and stable helpers for
 * subscribing (on) and sending (emit) events.
 *
 * Previously this hook created its own socket connection per component, which
 * caused duplicate connections. All components now share the single socket that
 * SocketProvider manages.
 *
 * The `on` callback changes reference when the underlying socket instance changes
 * (connect / reconnect), which lets effect dependency arrays naturally re-register
 * listeners after a reconnect without any manual coordination.
 */
interface SocketResult {
  socket: import("socket.io-client").Socket | null;
  isConnected: boolean;
  on: (event: string, callback: (data: unknown) => void) => () => void;
  emit: (event: string, data: unknown) => void;
}

export function useSocket(): SocketResult {
  const { socket, isConnected } = useContext(SocketContext);

  /**
   * Subscribe to a socket event. Returns a cleanup function that removes the listener.
   * Safe to call when socket is not yet connected — returns a no-op in that case.
   * Re-creates when the socket instance changes so callers automatically re-subscribe
   * after a reconnect.
   */
  const on = useCallback(
    (event: string, callback: (data: unknown) => void): (() => void) => {
      if (!socket) return () => {};
      socket.on(event, callback);
      return () => socket.off(event, callback);
    },
    [socket],
  );

  /**
   * Emit a socket event. No-ops if the socket is not connected.
   */
  const emit = useCallback(
    (event: string, data: unknown): void => {
      if (!socket) return;
      socket.emit(event, data);
    },
    [socket],
  );

  return { socket, isConnected, on, emit };
}
