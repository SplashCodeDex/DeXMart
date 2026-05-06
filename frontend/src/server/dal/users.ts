/**
 * Data Access Layer - Users
 *
 * Server-side operations for user documents.
 * Uses Firebase Admin SDK for privileged access.
 */

// import { getFirestore } from 'firebase-admin/firestore';
// import { z } from 'zod';

/**
 * Get user by ID
 */
export async function getUserById(_tenantId: string, _userId: string): Promise<null> {
  // Implementation will use:
  // const db = getFirestore();
  // const userRef = db.doc(`tenants/${tenantId}/users/${userId}`);
  // const snapshot = await userRef.get();
  // return snapshot.exists ? (snapshot.data() as UserDocument) : null;
  return null;
}

/**
 * Get users for a tenant
 */
export async function getTenantUsers(_tenantId: string): Promise<never[]> {
  // Implementation will query tenants/{tenantId}/users collection
  return [];
}
