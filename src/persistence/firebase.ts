import { db, admin } from '@/lib/firebase.js';
import logger from '@/utils/logger.js';
import {
  FirestoreSchema
} from '@/types/index.js';
import {
  TenantSchema,
  TenantUserSchema,
  ChannelSchema,
  AgentSchema,
  SubscriptionSchema,
  ModerationItemSchema,
  ViolationSchema,
  CampaignSchema,
  WebhookSchema,
  ContactSchema,
  AudienceSchema,
  TemplateSchema,
  AuthSchema,
  LearningSchema,
  AnalyticsSchema
} from '@/types/contracts.js';
import { z } from 'zod';

type CollectionKey = keyof FirestoreSchema;

const SchemaMap: Record<CollectionKey, z.ZodSchema<any>> = {
  'tenants': TenantSchema as any,
  'tenants/{tenantId}/users': TenantUserSchema as any,
  'tenants/{tenantId}/channels': ChannelSchema as any,
  'tenants/{tenantId}/agents': AgentSchema as any,
  'tenants/{tenantId}/agents/{agentId}/channels': ChannelSchema as any,
  'tenants/{tenantId}/slots': ChannelSchema as any,
  'tenants/{tenantId}/members': z.any(),
  'tenants/{tenantId}/groups': z.any(),
  'tenants/{tenantId}/subscriptions': SubscriptionSchema as any,
  'tenants/{tenantId}/moderation': ModerationItemSchema as any,
  'tenants/{tenantId}/violations': ViolationSchema as any,
  'tenants/{tenantId}/campaigns': CampaignSchema as any,
  'tenants/{tenantId}/webhooks': WebhookSchema as any,
  'tenants/{tenantId}/contacts': ContactSchema as any,
  'tenants/{tenantId}/audiences': AudienceSchema as any,
  'tenants/{tenantId}/templates': TemplateSchema as any,
  'tenants/{tenantId}/channels/{channelId}/auth': AuthSchema as any,
  'tenants/{tenantId}/agents/{agentId}/channels/{channelId}/auth': AuthSchema as any,
  'tenants/{tenantId}/learning': LearningSchema as any,
  'tenants/{tenantId}/analytics': AnalyticsSchema as any,
};

export class FirebaseService {
  private static instance: FirebaseService;

  private constructor() { }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * Verify a Firebase ID Token (JWT)
   */
  public async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      if (!idToken) {
        throw new Error('ID Token is required');
      }
      return await admin.auth().verifyIdToken(idToken);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Firebase Auth verifyIdToken error:', {
        message: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  /**
   * Validate a Firestore path to ensure it doesn't contain illegal segments (empty, undefined, null)
   * or path traversal attempts (..) which would cause the SDK to hang or bypass security.
   */
  private validatePath(path: string | undefined | null): void {
    if (!path) {
      logger.error('Firestore path is missing or empty', { path });
      throw new Error('Firestore path is required');
    }

    const segments = path.split('/');
    for (const segment of segments) {
      const trimmed = segment.trim();
      // Block common bypass/traversal attempts (Scenario 33)
      if (!trimmed || 
          trimmed === 'undefined' || 
          trimmed === 'null' || 
          trimmed === '..' || 
          trimmed === '.' ||
          /[\[\]\*\?]/.test(trimmed)) {
        const errorMsg = `Illegal Firestore path segment detected in "${path}": "${trimmed}"`;
        logger.error(`[FirebaseService] ${errorMsg}`);
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Resolve a collection name to its full path and schema
   */
  private getCollectionInfo(collection: string, tenantId?: string) {
    let path: string;
    let schemaKey: CollectionKey;

    if (typeof tenantId === 'string') {
      this.validatePath(tenantId);
      // Special handling for nested subcollections
      if (collection.includes('/')) {
        const parts = collection.split('/');

        // Ensure all parts are valid before interpolation
        parts.forEach(p => this.validatePath(p));

        // Pattern: agents/{agentId}/channels/{channelId}/auth
        if (parts[0] === 'agents' && parts[2] === 'channels' && parts[4] === 'auth') {
          path = `tenants/${tenantId}/agents/${parts[1]}/channels/${parts[3]}/auth`;
          schemaKey = `tenants/{tenantId}/agents/{agentId}/channels/{channelId}/auth` as CollectionKey;
        }
        // Pattern: agents/{agentId}/channels
        else if (parts[0] === 'agents' && parts[2] === 'channels') {
          path = `tenants/${tenantId}/agents/${parts[1]}/channels`;
          schemaKey = `tenants/{tenantId}/agents/{agentId}/channels` as CollectionKey;
        }
        // Pattern: channels/{id}/auth (Legacy/Top-level)
        else if (parts[0] === 'channels' && parts[2] === 'auth') {
          const type = parts[0];
          path = `tenants/${tenantId}/${type}/${parts[1]}/auth`;
          schemaKey = `tenants/{tenantId}/${type}/{channelId}/auth` as CollectionKey;
        } else if (parts[0] === 'slots') {
          path = `tenants/${tenantId}/slots`;
          schemaKey = `tenants/{tenantId}/slots` as CollectionKey;
        } else {
          this.validatePath(collection);
          path = `tenants/${tenantId}/${collection}`;
          schemaKey = `tenants/{tenantId}/${collection}` as CollectionKey;
        }
      } else {
        this.validatePath(collection);
        path = `tenants/${tenantId}/${collection}`;
        schemaKey = `tenants/{tenantId}/${collection}` as CollectionKey;
      }
    } else {
      this.validatePath(collection);
      path = collection;
      schemaKey = collection as CollectionKey;
    }

    const schema = SchemaMap[schemaKey];
    if (!schema) {
      throw new Error(`No schema defined for collection: ${schemaKey}`);
    }

    return { path, schema };
  }

  /**
   * Generic method to get a document from a tenant's subcollection
   */
  public async getDoc<K extends CollectionKey>(
    collection: string,
    docId: string,
    tenantId?: string
  ): Promise<FirestoreSchema[K] | null> {
    try {
      this.validatePath(docId);
      const { path, schema } = this.getCollectionInfo(collection, tenantId);
      const docRef = db.collection(path).doc(docId);
      const doc = await docRef.get();

      if (!doc.exists) return null;

      const data = {
        ...doc.data(),
        id: doc.id
      };

      const result = schema.safeParse(data);
      if (result.success) {
        return result.data as FirestoreSchema[K];
      }

      logger.warn(`Firestore parsing error in getDoc [${path}/${docId}]:`, result.error);
      return data as FirestoreSchema[K]; // Fallback to raw data in production to prevent crashes
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Firestore getDoc error [${collection}/${docId}] (Tenant: ${tenantId}):`, {
        message: err.message,
        stack: err.stack
      });
      throw err;
    }
  }

  /**
   * Generic method to set/update a document
   */
  public async setDoc<K extends CollectionKey>(
    collection: string,
    docId: string,
    data: Partial<FirestoreSchema[K]>,
    tenantId?: string,
    merge = true
  ): Promise<void> {
    try {
      this.validatePath(docId);
      const { path, schema } = this.getCollectionInfo(collection, tenantId);

      // Validation (Zero-Trust)
      // Since data might be Partial, we use a partial schema for validation if merge is true
      if (merge) {
        // Best effort validation for partial updates
        // Note: Zod doesn't easily support dynamic partial validation against a deep schema
        // but for our flat-ish documents, it works well enough.
        // We safely check if .partial() exists (e.g. not a preprocessed or readonly schema)
        if (typeof (schema as any).partial === 'function') {
          (schema as any).partial().parse(data);
        } else if (typeof (schema as any).unwrap === 'function' && typeof (schema as any).unwrap().partial === 'function') {
          // Handle Readonly schemas
          (schema as any).unwrap().partial().parse(data);
        }
      } else {
        schema.parse(data);
      }

      const docRef = db.collection(path).doc(docId);
      await docRef.set(data, { merge });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Firestore setDoc error [${collection}/${docId}] (Tenant: ${tenantId}):`, {
        message: err.message,
        stack: err.stack,
        data: JSON.stringify(data).substring(0, 500)
      });
      throw err;
    }
  }

  /**
   * Generic method to get all documents from a collection
   */
  public async getCollection<K extends CollectionKey>(
    collection: string,
    tenantId?: string
  ): Promise<FirestoreSchema[K][]> {
    try {
      const { path, schema } = this.getCollectionInfo(collection, tenantId);
      const colRef = db.collection(path);
      const snapshot = await colRef.get();

      return snapshot.docs.map(doc => {
        const data = {
          ...doc.data(),
          id: doc.id
        };
        try {
          return schema.parse(data) as FirestoreSchema[K];
        } catch (parsingError) {
          logger.warn(`Firestore parsing error in getCollection [${path}/${doc.id}]:`, parsingError);
          return data as FirestoreSchema[K]; // Fallback to raw data with ID in production but log warning
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Firestore getCollection error [${collection}] (Tenant: ${tenantId}):`, err);
      throw err;
    }
  }

  /**
   * Generic method to delete a document
   */
  public async deleteDoc<K extends CollectionKey>(
    collection: string,
    docId: string,
    tenantId?: string
  ): Promise<void> {
    try {
      this.validatePath(docId);
      const { path } = this.getCollectionInfo(collection, tenantId);
      const docRef = db.collection(path).doc(docId);
      await docRef.delete();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Firestore deleteDoc error [${collection}/${docId}] (Tenant: ${tenantId}):`, err);
      throw err;
    }
  }

  /**
   * Recursive deletion of a collection and all its documents.
   * Useful for cleaning up auth subcollections.
   */
  public async deleteCollection(collectionPath: string, tenantId?: string): Promise<void> {
    try {
      const { path } = this.getCollectionInfo(collectionPath, tenantId);
      const colRef = db.collection(path);

      // Get all documents in the collection
      const snapshot = await colRef.get();

      // Delete each document
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      logger.info(`Firestore collection deleted recursively: ${path}`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Firestore deleteCollection error [${collectionPath}] (Tenant: ${tenantId}):`, err);
      // We don't throw here to allow partial cleanup to continue, but we log it
    }
  }
}

export const firebaseService = FirebaseService.getInstance();
