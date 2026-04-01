import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Mock dependencies using vi.mock
const mockApps: any[] = [];
const mockCredential = {
  cert: vi.fn(),
  applicationDefault: vi.fn(),
};
const mockFirestore = {
  settings: vi.fn(),
};
const mockAdmin = {
  credential: mockCredential,
  initializeApp: vi.fn(() => {
    mockApps.push({});
    return {};
  }),
  firestore: vi.fn(() => mockFirestore),
  apps: mockApps,
};

vi.mock('firebase-admin', () => ({
  default: mockAdmin,
}));

const mockConfig = {
  get: vi.fn(),
};
vi.mock('@/services/ConfigService.js', () => ({
  ConfigService: {
    getInstance: vi.fn(() => mockConfig),
  },
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('@/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Firebase Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApps.length = 0;
  });

  it('should initialize with application default credentials', async () => {
    mockConfig.get.mockReturnValue(undefined);
    
    // In Vitest, we can re-import or use dynamic imports
    const { db } = await import('@/lib/firebase.js');
    
    // Trigger lazy init
    // @ts-ignore
    const test = db.collection;

    expect(mockCredential.applicationDefault).toHaveBeenCalled();
    expect(mockAdmin.initializeApp).toHaveBeenCalled();
  });
});