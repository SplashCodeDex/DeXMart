import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseService } from './FirebaseService.js';
import { admin } from '../lib/firebase.js';

// Mock the admin auth module
vi.mock('../lib/firebase.js', () => ({
  admin: {
    auth: vi.fn(),
  },
  db: {
    collection: vi.fn(),
  },
}));

describe('FirebaseService', () => {
  let firebaseService: FirebaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    firebaseService = FirebaseService.getInstance();
  });

  it('should be defined', () => {
    expect(firebaseService).toBeDefined();
  });

  describe('verifyIdToken', () => {
    it('should verify a valid token and return decoded token', async () => {
      const mockToken = 'valid-token';
      const mockDecodedToken = { uid: 'user-123', email: 'test@example.com' };
      
      // Setup mock
      const verifyIdTokenMock = vi.fn().mockResolvedValue(mockDecodedToken);
      (admin.auth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ verifyIdToken: verifyIdTokenMock });

      // @ts-ignore - method doesn't exist yet
      const result = await firebaseService.verifyIdToken(mockToken);

      expect(verifyIdTokenMock).toHaveBeenCalledWith(mockToken);
      expect(result).toEqual(mockDecodedToken);
    });

    it('should throw an error for invalid token', async () => {
      const mockToken = 'invalid-token';
      const mockError = new Error('Invalid token');

      // Setup mock
      const verifyIdTokenMock = vi.fn().mockRejectedValue(mockError);
      (admin.auth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ verifyIdToken: verifyIdTokenMock });

      // @ts-ignore - method doesn't exist yet
      await expect(firebaseService.verifyIdToken(mockToken)).rejects.toThrow('Invalid token');
    });
  });
});
