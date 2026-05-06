import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api/client";
import type { ActivityEvent } from "@/types/omnichannel";
import { useOmnichannelStore } from "./useOmnichannelStore";

// Mock the api client
vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("useOmnichannelStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useOmnichannelStore.setState({
      channels: [],
      activity: [],
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it("should initialize with default values", () => {
    const state = useOmnichannelStore.getState();
    expect(state.channels).toEqual([]);
    expect(state.activity).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  it("should fetch channels successfully", async () => {
    const mockChannels = [
      {
        id: "bot_1",
        name: "WhatsApp Bot",
        type: "whatsapp",
        status: "connected",
        account: "123456789",
      },
    ];

    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: mockChannels,
    });

    await useOmnichannelStore.getState().fetchChannels();

    const state = useOmnichannelStore.getState();
    expect(state.channels).toEqual(mockChannels);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  it("should handle fetch errors", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: { message: "API Error" },
    });

    await useOmnichannelStore.getState().fetchChannels();

    const state = useOmnichannelStore.getState();
    expect(state.channels).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("API Error");
  });

  it("should update channel status", () => {
    useOmnichannelStore.setState({
      channels: [
        { id: "bot_1", name: "Bot", type: "whatsapp", status: "disconnected", account: null },
      ],
    });

    useOmnichannelStore.getState().updateChannelStatus("bot_1", "connected");

    expect(useOmnichannelStore.getState().channels[0]!.status).toBe("connected");
  });

  it("should add activity events", () => {
    const event = {
      botId: "bot_1",
      channel: "whatsapp",
      type: "inbound",
      message: "Hello",
      timestamp: new Date().toISOString(),
    };

    useOmnichannelStore.getState().addActivityEvent(event as Omit<ActivityEvent, "id">);

    const state = useOmnichannelStore.getState();
    expect(state.activity).toHaveLength(1);
    expect(state.activity[0]!.message).toBe("Hello");
    expect(state.activity[0]!.id).toBeDefined();
  });

  it("should handle progress updates", () => {
    useOmnichannelStore.setState({
      channels: [
        { id: "bot_1", name: "Bot", type: "whatsapp", status: "disconnected", account: null },
      ],
    });

    useOmnichannelStore.getState().handleProgressUpdate({
      botId: "bot_1",
      step: "Connecting",
      status: "complete",
      timestamp: new Date().toISOString(),
    });

    const state = useOmnichannelStore.getState();
    expect(state.channels[0]!.status).toBe("connected");
    expect(state.activity).toHaveLength(1);
    expect(state.activity[0]!.message).toContain("Connecting: complete");
  });

  it("should disconnect channel successfully", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {},
    });
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: [] });

    const success = await useOmnichannelStore.getState().disconnectChannel("agent_1", "bot_1");

    expect(success).toBe(true);
    expect(api.post).toHaveBeenCalled();
    expect(api.get).toHaveBeenCalled(); // Should refresh (fetchAllChannels)
  });

  it("should delete channel successfully", async () => {
    (api.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {},
    });
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: [] });

    const success = await useOmnichannelStore.getState().deleteChannel("agent_1", "bot_1");

    expect(success).toBe(true);
    expect(api.delete).toHaveBeenCalled();
    expect(api.get).toHaveBeenCalled(); // Should refresh (fetchAllChannels)
  });
});
