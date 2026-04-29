import React from "react";
import { StatusBadge, type StatusBadgeStatus } from "@/components/shared/StatusBadge";
import type { ChannelStatus } from "@/types/omnichannel";

interface ChannelStatusBadgeProps {
  status: ChannelStatus;
  size?: "default" | "sm";
  className?: string;
}

const statusMap: Record<ChannelStatus, { status: StatusBadgeStatus; label: string }> = {
  connected: { status: "online", label: "Online" },
  connecting: { status: "connecting", label: "Connecting" },
  initializing: { status: "connecting", label: "Starting" },
  qr_pending: { status: "warning", label: "Scan QR" },
  disconnected: { status: "offline", label: "Offline" },
  logged_out: { status: "offline", label: "Logged Out" },
  error: { status: "error", label: "Error" },
  reconnect_exhausted: { status: "error", label: "Retry Failed" },
  banned: { status: "error", label: "Banned" },
  archived: { status: "offline", label: "Archived" },
};

export function ChannelStatusBadge({
  status,
  size = "default",
  className,
}: ChannelStatusBadgeProps): React.ReactElement {
  const config = statusMap[status] || { status: "offline", label: status };

  return (
    <StatusBadge status={config.status} label={config.label} size={size} className={className} />
  );
}
