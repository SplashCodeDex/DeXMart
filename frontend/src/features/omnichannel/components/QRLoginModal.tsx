"use client";

import { useEffect, useRef, useState } from "react";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

const QR_TIMEOUT_MS = 60_000;
const QR_TIMEOUT_S = QR_TIMEOUT_MS / 1000;

interface QRLoginModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
  accountId?: string;
}

export function QRLoginModal({ open, onClose, onConnected, accountId }: QRLoginModalProps) {
  const callStart = useRpcCall("web.login.start");
  const callWait = useRpcCall("web.login.wait");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(QR_TIMEOUT_S);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setQrDataUrl(null);
      setLoading(false);
      return;
    }

    cancelledRef.current = false;

    const runQrFlow = async () => {
      while (!cancelledRef.current) {
        setLoading(true);
        setQrDataUrl(null);

        try {
          const startResult = await callStart({
            accountId,
            force: true,
            timeoutMs: QR_TIMEOUT_MS,
          });

          if (cancelledRef.current) break;
          setQrDataUrl(startResult.qrDataUrl ?? null);
          setLoading(false);

          const waitResult = await callWait({
            accountId,
            timeoutMs: QR_TIMEOUT_MS,
          });

          if (cancelledRef.current) break;

          if (waitResult.connected) {
            onConnected();
            return;
          }
        } catch {
          if (!cancelledRef.current) {
            setLoading(false);
            // Optionally add a small delay before retrying or break on fatal
            await new Promise((r) => setTimeout(r, 2000));
          }
          continue;
        }
        // connected: false → loop for auto-refresh
      }
    };

    void runQrFlow();

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || loading || qrDataUrl === null) return;
    setCountdown(QR_TIMEOUT_S);
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [open, loading, qrDataUrl]);

  if (!open) return null;

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {loading || qrDataUrl === null ? (
        <div
          role="status"
          aria-label="Loading QR code"
          className="flex items-center justify-center p-8 text-muted-foreground text-sm"
        >
          Loading QR code…
        </div>
      ) : (
        <>
          <img
            src={qrDataUrl}
            alt="QR code — scan in WhatsApp to connect"
            className="h-48 w-48 rounded-md"
          />
          <p data-testid="qr-countdown" className="text-sm text-muted-foreground">
            Expires in {countdown}s
          </p>
        </>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-md px-4 py-2 text-sm border border-input hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  );
}
