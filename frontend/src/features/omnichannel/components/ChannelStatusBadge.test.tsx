import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { ChannelStatus } from "@/types/omnichannel";
import { ChannelStatusBadge } from "./ChannelStatusBadge";

describe("ChannelStatusBadge", () => {
  it("renders 'Online' for 'connected' status", () => {
    render(<ChannelStatusBadge status="connected" />);
    expect(screen.getByText(/online/i)).toBeDefined();
  });

  it("renders 'Connecting' for 'connecting' status", () => {
    render(<ChannelStatusBadge status="connecting" />);
    expect(screen.getByText(/connecting/i)).toBeDefined();
  });

  it("renders 'Starting' for 'initializing' status", () => {
    render(<ChannelStatusBadge status="initializing" />);
    expect(screen.getByText(/starting/i)).toBeDefined();
  });

  it("renders 'Scan QR' for 'qr_pending' status", () => {
    render(<ChannelStatusBadge status="qr_pending" />);
    expect(screen.getByText(/scan qr/i)).toBeDefined();
  });

  it("renders 'Offline' for 'disconnected' status", () => {
    render(<ChannelStatusBadge status="disconnected" />);
    expect(screen.getByText(/offline/i)).toBeDefined();
  });

  it("renders 'Error' for 'error' status", () => {
    render(<ChannelStatusBadge status="error" />);
    expect(screen.getByText(/error/i)).toBeDefined();
  });

  it("renders 'Banned' for 'banned' status", () => {
    render(<ChannelStatusBadge status="banned" />);
    expect(screen.getByText(/banned/i)).toBeDefined();
  });

  it("renders raw status for unknown status", () => {
    // @ts-expect-error - testing unknown status
    render(<ChannelStatusBadge status="unknown_status" />);
    expect(screen.getByText(/unknown_status/i)).toBeDefined();
  });
});
