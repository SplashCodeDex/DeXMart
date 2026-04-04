import { Timestamp } from 'firebase-admin/firestore';
import { firebaseService } from '@/services/FirebaseService.js';
import logger from '@/utils/logger.js';
import { TenantUserDocument } from '@/types/index.js';

export class UserService {
  private static instance: UserService;

  private constructor() { }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Compute user status based on activity and ban status
   */
  public computeStatus(user: Partial<TenantUserDocument>): 'active' | 'inactive' | 'banned' {
    if (user.metadata?.banned) return 'banned';

    const lastActivity = user.lastLogin;
    if (!lastActivity) return 'inactive';

    const lastMillis = lastActivity instanceof Timestamp ? lastActivity.toMillis() : new Date(lastActivity).getTime();
    const days30 = 30 * 24 * 60 * 60 * 1000;

    return Date.now() - lastMillis > days30 ? 'inactive' : 'active';
  }

  /**
   * Get user by ID within a tenant scope
   */
  async getUserById(tenantId: string, userId: string): Promise<TenantUserDocument | null> {
    try {
      return await firebaseService.getDoc<'tenants/{tenantId}/users'>('users', userId, tenantId);
    } catch (error: unknown) {
      logger.error(`UserService.getUserById error [${tenantId}/${userId}]:`, error);
      return null;
    }
  }

  /**
   * Create or update user within a tenant scope
   */
  async saveUser(tenantId: string, user: TenantUserDocument): Promise<void> {
    try {
      await firebaseService.setDoc<'tenants/{tenantId}/users'>('users', user.id, user, tenantId);
    } catch (error: unknown) {
      logger.error(`UserService.saveUser error [${tenantId}/${user.id}]:`, error);
      throw error;
    }
  }

  /**
   * Update user last login timestamp
   */
  async updateLastLogin(tenantId: string, userId: string): Promise<void> {
    try {
      await firebaseService.setDoc<'tenants/{tenantId}/users'>(
        'users',
        userId,
        { lastLogin: Timestamp.now() },
        tenantId,
        true
      );
    } catch (error: unknown) {
      logger.error(`UserService.updateLastLogin error [${tenantId}/${userId}]:`, error);
    }
  }
}

export const userService = UserService.getInstance();
export default userService;
