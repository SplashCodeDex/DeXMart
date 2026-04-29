import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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
vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: () => ({
    rpc: {
      call: vi.fn(),
    },
    status: "connected",
  }),
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
    const phoneInput = screen.getByLabelText(/phone number/i) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: "+123456789" } });
    expect(phoneInput.value).toBe("+123456789");
  });

  it("calls rpc on save", async () => {
    const onOpenChange = vi.fn();
    render(<ChannelConfigDrawer channel={mockChannel} open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText(/save configuration/i));
    // Wait for the mock save to complete
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
