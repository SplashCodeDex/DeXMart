import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { firebaseService } from "../persistence/firebase.js";
import { TemplateService } from "../services/templateService.js";
import { getCampaignWorker } from "./campaignWorker.js";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockFirebase, mockJobQueue, mockChannelService, mockTemplateService, mockAntiBan } =
  vi.hoisted(() => ({
    mockFirebase: {
      getDoc: vi.fn(),
      getCollection: vi.fn(),
      setDoc: vi.fn(),
    },
    mockJobQueue: {
      addJob: vi.fn().mockResolvedValue(undefined),
    },
    mockChannelService: {
      getActiveChannelIds: vi.fn().mockReturnValue([{ id: "chan_1", isActive: true }]),
    },
    mockTemplateService: {
      getTemplate: vi.fn(),
    },
    mockAntiBan: {
      checkContentHash: vi.fn().mockResolvedValue(false),
      triggerCooldown: vi.fn().mockResolvedValue(undefined),
    },
  }));

// Mock dependencies
vi.mock("../persistence/firebase.js", () => ({
  firebaseService: mockFirebase,
  FirebaseService: { getInstance: () => mockFirebase },
}));

vi.mock("../services/jobQueue.js", () => ({
  default: mockJobQueue,
}));

vi.mock("../services/ChannelService.js", () => ({
  channelService: mockChannelService,
}));

vi.mock("../services/templateService.js", () => ({
  TemplateService: { getInstance: () => mockTemplateService },
}));

vi.mock("../services/antiBanService.js", () => ({
  antiBanService: mockAntiBan,
}));

vi.mock("../services/webhookService.js", () => ({
  webhookService: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../services/socketService.js", () => ({
  socketService: { emitProgress: vi.fn() },
}));

vi.mock("../services/groupService.js", () => ({
  groupService: { syncAllGroups: vi.fn(), syncGroup: vi.fn() },
}));

vi.mock("../services/ai-utility.js", () => ({
  AIUtilityService: { spinMessage: vi.fn() },
}));

vi.mock("../utils/logger.js", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../dexmart-config/ConfigManager.js", () => ({
  default: {
    config: {
      redis: { host: "localhost", port: 6379, password: undefined },
    },
  },
}));

// Mock BullMQ Worker
vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(function () {
    return { on: vi.fn() };
  }),
}));

describe("CampaignWorker throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockJobQueue.addJob.mockResolvedValue(undefined);
    mockAntiBan.checkContentHash.mockResolvedValue(false);
    mockChannelService.getActiveChannelIds.mockReturnValue([{ id: "chan_1", isActive: true }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should enqueue messages via job queue with delays between them", async () => {
    const tenantId = "tenant_1";
    const campaign = {
      id: "camp_1",
      templateId: "tpl_1",
      audience: { type: "audience", targetId: "aud_1" },
      distribution: { type: "single", channelId: "chan_1" },
      antiBan: { minDelay: 1, maxDelay: 2, aiSpinning: false, batchSize: 0 },
      stats: { sent: 0, failed: 0 },
    };

    const mockContacts = [
      { phone: "111", name: "U1" },
      { phone: "222", name: "U2" },
    ];

    mockFirebase.getDoc.mockResolvedValue(campaign);
    mockFirebase.getCollection.mockImplementation(async (col: string) => {
      if (col === "contacts") return mockContacts;
      return [];
    });
    mockFirebase.setDoc.mockResolvedValue(undefined);

    mockTemplateService.getTemplate.mockResolvedValue({ success: true, data: { content: "Hi" } });

    const worker = getCampaignWorker() as any;

    // Start processing
    const promise = worker.processCampaign({ data: { tenantId, campaign } } as any);

    // Wait for first message and delay start
    await vi.advanceTimersByTimeAsync(0);
    expect(mockJobQueue.addJob).toHaveBeenCalledTimes(1);

    // Advance past the first delay (1-2s)
    await vi.advanceTimersByTimeAsync(2000);

    // Should have enqueued the second message
    await promise;
    expect(mockJobQueue.addJob).toHaveBeenCalledTimes(2);
    expect(mockJobQueue.addJob).toHaveBeenCalledWith(
      "whatsapp-outbound",
      "campaign-send",
      expect.objectContaining({ tenantId, channelId: "chan_1" }),
    );
  });
});
