import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { useConfig } from "@/lib/gateway/useConfig";
import type { Channel } from "@/types/omnichannel";
import { ChannelConfigDrawer } from "./ChannelConfigDrawer";

// Mock Sheet component
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
  SheetFooter: ({ children }: any) => <div>{children}</div>,
}));

// Mock useGateway hook
const mockRpcCall = vi.fn();
vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: vi.fn(() => ({
    rpc: {
      call: mockRpcCall,
    },
    status: "connected",
  })),
}));

// Mock useConfig hook
vi.mock("@/lib/gateway/useConfig", () => ({
  useConfig: vi.fn(() => ({
    baseHash: "test-hash",
    refresh: vi.fn(),
  })),
}));

const mockChannel: Channel = {
  id: "chan-1",
  name: "WhatsApp Test",
  type: "whatsapp",
  status: "connected",
  account: "acc-1",
};

describe("ChannelConfigDrawer", () => {
  it("renders when open", () => {
    render(<ChannelConfigDrawer channel={mockChannel} open={true} onOpenChange={() => {}} />);
    expect(screen.getByTestId("sheet-content")).toBeDefined();
    expect(screen.getByText(/WhatsApp Test/i)).toBeDefined();
  });

  it("calls onOpenChange when closed", () => {
    const onOpenChange = vi.fn();
    render(<ChannelConfigDrawer channel={mockChannel} open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText(/cancel/i));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("updates inputs when typed", () => {
    render(<ChannelConfigDrawer channel={mockChannel} open={true} onOpenChange={() => {}} />);

    const sessionInput = screen.getByLabelText(/session name/i) as HTMLInputElement;
    fireEvent.change(sessionInput, { target: { value: "New Session Name" } });
    expect(sessionInput.value).toBe("New Session Name");

    const phoneInput = screen.getByLabelText(/phone number/i) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: "+123456789" } });
    expect(phoneInput.value).toBe("+123456789");

    const webhookInput = screen.getByLabelText(/custom webhook url/i) as HTMLInputElement;
    fireEvent.change(webhookInput, { target: { value: "https://test.com" } });
    expect(webhookInput.value).toBe("https://test.com");
  });

  it("calls rpc on save", async () => {
    const onOpenChange = vi.fn();
    render(<ChannelConfigDrawer channel={mockChannel} open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText(/save configuration/i));
    // Wait for the mock save to complete
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("handles save error", async () => {
    mockRpcCall.mockRejectedValueOnce(new Error("RPC Failed"));

    const onOpenChange = vi.fn();
    render(<ChannelConfigDrawer channel={mockChannel} open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText(/save configuration/i));

    // Wait for the mock save to fail and loading to stop
    await vi.waitFor(() => expect(screen.queryByText(/saving/i)).toBeNull());
    // onOpenChange should NOT be called with false on error
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
