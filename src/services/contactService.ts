import crypto from "node:crypto";
import fs from "node:fs";
import { existsSync } from "node:fs";
import { parse } from "csv-parse";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseService } from "@/persistence/firebase.js";
import { FIELD_ALIASES } from "../../shared/fieldAliases.js";
import { db } from "../lib/firebase.js";
import { ContactSchema, Result, type Contact } from "../types/contracts.js";
import logger from "../utils/logger.js";

const normalizePhoneNumber = (phone: string): string => {
  if (
    phone.includes("@s.whatsapp.net") ||
    phone.includes("@g.us") ||
    phone.includes("@lid") ||
    phone.includes("@hosted.lid")
  ) {
    return phone;
  }
  const digits = phone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
};

export class ContactService {
  private static instance: ContactService;

  private constructor() {}

  public static getInstance(): ContactService {
    if (!ContactService.instance) {
      ContactService.instance = new ContactService();
    }
    return ContactService.instance;
  }

  /**
   * Import contacts from CSV
   */
  public async importContacts(
    tenantId: string,
    filePath: string,
    channelId?: string,
  ): Promise<Result<{ count: number; errors: string[]; contactIds: string[] }>> {
    const errors: string[] = [];
    const contactIds: string[] = [];
    let count = 0;
    let rowIndex = 0;
    const BATCH_SIZE = 500;
    let currentBatch = db.batch();
    let currentBatchSize = 0;
    const batchPromises: Promise<any>[] = [];

    try {
      const parser = fs.createReadStream(filePath).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }),
      );

      for await (const record of parser) {
        rowIndex++;
        const rawData = record as Record<string, string>;
        const keys = Object.keys(rawData);

        // helper to get value from first matching alias
        const getVal = (field: keyof typeof FIELD_ALIASES) => {
          const aliases = FIELD_ALIASES[field];
          const matchKey = keys.find((k) => {
            const nk = k.toLowerCase().trim();
            return (aliases as readonly string[]).some((a: string) => nk === a || nk.includes(a));
          });
          return matchKey ? rawData[matchKey] : undefined;
        };

        const name = getVal("name") || "Unknown";
        const phone = getVal("phone") || "";
        const email = getVal("email") || "";
        const tagsRaw = getVal("tags") || "";

        const contactData = {
          id: `cont_${crypto.randomUUID()}`,
          tenantId,
          name,
          phone: phone ? normalizePhoneNumber(phone) : "",
          email,
          tags: tagsRaw ? tagsRaw.split("|").map((t: string) => t.trim()) : [],
          attributes: rawData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const validation = ContactSchema.safeParse(contactData);
        if (!validation.success) {
          const msg = validation.error.issues
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", ");
          errors.push(`Row ${rowIndex + 1}: ${msg}`);
        } else {
          const contactRef = db
            .collection("tenants")
            .doc(tenantId)
            .collection("contacts")
            .doc(contactData.id);
          currentBatch.set(contactRef, validation.data);
          count++;
          contactIds.push(contactData.id);
          currentBatchSize++;

          if (currentBatchSize >= BATCH_SIZE) {
            batchPromises.push(currentBatch.commit());
            currentBatch = db.batch();
            currentBatchSize = 0;
          }
        }
      }

      if (currentBatchSize > 0) {
        batchPromises.push(currentBatch.commit());
      }
      await Promise.all(batchPromises);

      // Record Import History
      const importId = `imp_${crypto.randomUUID()}`;
      try {
        await db
          .collection("tenants")
          .doc(tenantId)
          .collection("importHistory")
          .doc(importId)
          .set({
            id: importId,
            timestamp: FieldValue.serverTimestamp(),
            fileName: filePath.split(/[\\/]/).pop() || "unknown.csv",
            totalRows: rowIndex,
            importedCount: count,
            errors,
            contactIds,
            status: "completed",
          });
      } catch (historyError) {
        logger.error("Failed to record import history", historyError);
      }

      // Update channel statistics (contactsCount)
      if (count > 0) {
        try {
          if (channelId) {
            // Update specific channel
            await firebaseService.setDoc<"users/{userId}/channels">(
              "channels",
              channelId,
              { "stats.contactsCount": FieldValue.increment(count) } as any,
              tenantId,
              true,
            );
          } else {
            const channels = await firebaseService.getCollection<"users/{userId}/channels">(
              "channels",
              tenantId,
            );
            const statsPromises = channels.map((channel) =>
              firebaseService.setDoc<"users/{userId}/channels">(
                "channels",
                channel.id,
                { "stats.contactsCount": FieldValue.increment(count) } as any,
                tenantId,
                true,
              ),
            );
            await Promise.all(statsPromises);
          }
        } catch (statsError) {
          logger.error("Failed to update channel stats after import", statsError);
        }
      }

      if (rowIndex === 0) {
        return { success: false, error: new Error("CSV contains no data rows") };
      }

      return { success: true, data: { count, errors, contactIds } };
    } catch (error: unknown) {
      logger.error("Error parsing CSV", error);
      const err = error as { code?: string; message?: string };
      if (err.code === "CSV_INVALID_COLUMN_NAME") {
        return {
          success: false,
          error: new Error("Invalid CSV headers. Please check for duplicates."),
        };
      }
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * List contacts for a tenant
   */
  public async listContacts(tenantId: string, limit: number = 100): Promise<Result<Contact[]>> {
    try {
      const contacts = (await firebaseService.getCollection(
        "contacts" as any,
        tenantId,
      )) as Contact[];
      return { success: true, data: contacts.slice(0, limit) };
    } catch (error: unknown) {
      logger.error("ContactService.listContacts error", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Create a new contact
   */
  public async createContact(tenantId: string, data: Partial<Contact>): Promise<Result<Contact>> {
    try {
      const id = data.id || `cont_${crypto.randomUUID()}`;
      const contactData = {
        ...data,
        id,
        tenantId,
        createdAt: data.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const validated = ContactSchema.parse(contactData);
      await firebaseService.setDoc("contacts" as any, id, validated, tenantId, false);
      return { success: true, data: validated };
    } catch (error: unknown) {
      logger.error("ContactService.createContact error", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Update a contact
   */
  public async updateContact(
    tenantId: string,
    contactId: string,
    updates: Partial<Contact>,
  ): Promise<Result<void>> {
    try {
      const contactData = {
        ...updates,
        updatedAt: new Date(),
      };
      await firebaseService.setDoc("contacts" as any, contactId, contactData, tenantId, true);
      return { success: true, data: undefined };
    } catch (error: unknown) {
      logger.error("ContactService.updateContact error", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Delete a contact
   */
  public async deleteContact(tenantId: string, contactId: string): Promise<Result<void>> {
    try {
      await firebaseService.deleteDoc("contacts" as any, contactId, tenantId);
      return { success: true, data: undefined };
    } catch (error: unknown) {
      logger.error("ContactService.deleteContact error", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Check which phone numbers already exist in the database.
   * Firestore 'in' query is limited to 30 items, so we chunk the input.
   */
  public async checkDuplicates(tenantId: string, phones: string[]): Promise<Result<string[]>> {
    try {
      const uniquePhones = [...new Set(phones)].filter((p) => p.length > 0);
      const duplicates: string[] = [];
      const CHUNK_SIZE = 30;

      for (let i = 0; i < uniquePhones.length; i += CHUNK_SIZE) {
        const chunk = uniquePhones.slice(i, i + CHUNK_SIZE);
        const snapshot = await db
          .collection("tenants")
          .doc(tenantId)
          .collection("contacts")
          .where("phone", "in", chunk)
          .get();

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.phone) duplicates.push(data.phone);
        });
      }

      return { success: true, data: duplicates };
    } catch (error: unknown) {
      logger.error("ContactService.checkDuplicates error", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Undo an import by deleting all contacts created in that batch.
   */
  public async undoImport(tenantId: string, importId: string): Promise<Result<void>> {
    try {
      const historyRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("importHistory")
        .doc(importId);

      const historyDoc = await historyRef.get();
      if (!historyDoc.exists) {
        return { success: false, error: new Error("Import history not found") };
      }

      const historyData = historyDoc.data()!;
      if (historyData.status === "rolled_back") {
        return { success: false, error: new Error("Import already rolled back") };
      }

      const contactIds = historyData.contactIds || [];
      const BATCH_SIZE = 500;

      // Batch delete contacts
      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const chunk = contactIds.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach((id: string) => {
          const contactRef = db.collection("tenants").doc(tenantId).collection("contacts").doc(id);
          batch.delete(contactRef);
        });
        await batch.commit();
      }

      // Update history status
      await historyRef.update({
        status: "rolled_back",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update channel stats (decrement)
      if (historyData.importedCount > 0) {
        try {
          const channels = await firebaseService.getCollection<"users/{userId}/channels">(
            "channels",
            tenantId,
          );
          const statsPromises = channels.map((channel) =>
            firebaseService.setDoc<"users/{userId}/channels">(
              "channels",
              channel.id,
              { "stats.contactsCount": FieldValue.increment(-historyData.importedCount) } as any,
              tenantId,
              true,
            ),
          );
          await Promise.all(statsPromises);
        } catch (statsError) {
          logger.error("Failed to decrement channel stats after undo", statsError);
        }
      }

      return { success: true, data: undefined };
    } catch (error: unknown) {
      logger.error("ContactService.undoImport error", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * List import history for a tenant
   */
  public async listImportHistory(tenantId: string, limit: number = 50): Promise<Result<any[]>> {
    try {
      const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("importHistory")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      const history = snapshot.docs.map((doc) => doc.data());
      return { success: true, data: history };
    } catch (error: unknown) {
      logger.error("ContactService.listImportHistory error", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Get audiences for a tenant
   */
  public async getAudience(tenantId: string): Promise<Result<any[]>> {
    try {
      const audiences = await firebaseService.getCollection("audiences" as any, tenantId);
      return { success: true, data: audiences };
    } catch (error: unknown) {
      logger.error("Error fetching audience", error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}
