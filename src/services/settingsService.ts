
"use strict";

import { db } from '../lib/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

class SettingsService {
  private collection = db.collection('settings');
  private settings: Map<string, any>;

  constructor() {
    this.settings = new Map();
    this.initializeDefaultSettings();
  }

  initializeDefaultSettings() {
    const defaultSettings = {
      'general.channelName': { category: 'general', key: 'channelName', value: 'DeXMart', valueType: 'string', description: 'Channel display name', isEncrypted: false },
      'general.channelDescription': { category: 'general', key: 'channelDescription', value: 'Advanced WhatsApp Channel with AI Features', valueType: 'string', description: 'Channel description', isEncrypted: false },
      'general.ownerName': { category: 'general', key: 'ownerName', value: 'CodeDeX', valueType: 'string', description: 'Channel owner name', isEncrypted: false },
      'general.timezone': { category: 'general', key: 'timezone', value: 'Africa/Accra', valueType: 'string', description: 'System timezone', isEncrypted: false },

      // Security
      'security.jwtSecret': { category: 'security', key: 'jwtSecret', value: process.env.JWT_SECRET || 'change-me', valueType: 'string', description: 'JWT signing secret', isEncrypted: true },
      'security.bcryptRounds': { category: 'security', key: 'bcryptRounds', value: 12, valueType: 'number', description: 'BCrypt hashing rounds', isEncrypted: false },
      'security.maxLoginAttempts': { category: 'security', key: 'maxLoginAttempts', value: 5, valueType: 'number', description: 'Maximum login attempts before lockout', isEncrypted: false },

      // API
      'api.geminiApiKey': { category: 'api', key: 'geminiApiKey', value: process.env.GOOGLE_GEMINI_API_KEY || '', valueType: 'string', description: 'Google Gemini API key', isEncrypted: true },
      'api.stripeSecretKey': { category: 'api', key: 'stripeSecretKey', value: process.env.STRIPE_SECRET_KEY || '', valueType: 'string', description: 'Stripe secret key', isEncrypted: true },
      'api.stripeWebhookSecret': { category: 'api', key: 'stripeWebhookSecret', value: process.env.STRIPE_WEBHOOK_SECRET || '', valueType: 'string', description: 'Stripe webhook secret', isEncrypted: true },

      // Database
      'database.host': { category: 'database', key: 'host', value: process.env.DB_HOST || 'localhost', valueType: 'string', description: 'Database host', isEncrypted: false },
      'database.port': { category: 'database', key: 'port', value: Number(process.env.DB_PORT || 5432), valueType: 'number', description: 'Database port', isEncrypted: false },
      'database.database': { category: 'database', key: 'database', value: process.env.DB_NAME || 'DeXMart', valueType: 'string', description: 'Database name', isEncrypted: false },
    };

    Object.entries(defaultSettings).forEach(([key, setting]) => {
      this.settings.set(key, { ...setting, updatedAt: new Date() });
    });
  }

  parseValue(value: any, type: string) {
    if (type === 'number') return Number(value);
    if (type === 'boolean') return value === true || value === 'true';
    if (type === 'json') {
      try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return value; }
    }
    return value;
  }

  stringifyValue(value: any, type: string) {
    if (type === 'json') return JSON.stringify(value);
    return String(value);
  }

  async getAllSettings() {
    const snapshot = await this.collection.get();
    const dbSettings = snapshot.docs.map(doc => doc.data());

    const settings: any = {};
    for (const [, setting] of this.settings.entries()) {
      const dbOverride = dbSettings.find((s: any) => s.category === setting.category && s.key === setting.key);
      const value = dbOverride ? this.parseValue(dbOverride.value, setting.valueType) : setting.value;
      if (!settings[setting.category]) settings[setting.category] = {};
      settings[setting.category][setting.key] = value;
    }
    return settings;
  }

  async getSettingsByCategory(category: string) {
    const snapshot = await this.collection.where('category', '==', category).get();
    const dbSettings = snapshot.docs.map(doc => doc.data());

    const categorySettings = [];
    for (const [, setting] of this.settings.entries()) {
      if (setting.category === category) {
        const dbOverride = dbSettings.find((s: any) => s.key === setting.key);
        const value = dbOverride ? this.parseValue(dbOverride.value, setting.valueType) : setting.value;
        categorySettings.push({ ...setting, value });
      }
    }
    return categorySettings;
  }

  async getSetting(category: string, key: string) {
    const settingKey = `${category}.${key}`;
    const base = this.settings.get(settingKey) || null;
    if (!base) return null;

    const docId = `${category}_${key}`;
    const doc = await this.collection.doc(docId).get();

    const dbValue = doc.exists ? doc.data()?.value : null;
    const value = dbValue !== null && dbValue !== undefined ? this.parseValue(dbValue, base.valueType) : base.value;

    return { ...base, value };
  }

  async updateSetting(category: string, key: string, value: any, description?: string, updatedBy?: string) {
    const settingKey = `${category}.${key}`;
    const existingSetting = this.settings.get(settingKey);

    if (!existingSetting) {
      throw new Error(`Setting ${settingKey} not found`);
    }

    const valueStr = this.stringifyValue(value, existingSetting.valueType);
    const docId = `${category}_${key}`;

    const data = {
      category,
      key,
      value: valueStr,
      valueType: existingSetting.valueType,
      description: description || existingSetting.description,
      isEncrypted: existingSetting.isEncrypted || false,
      updatedBy: updatedBy || 'system',
      updatedAt: Timestamp.now()
    };

    await this.collection.doc(docId).set(data);

    const updatedSetting = { ...existingSetting, value, description: description || existingSetting.description, updatedAt: new Date() };
    this.settings.set(settingKey, updatedSetting);
    return updatedSetting;
  }

  // Validation logic remains generic
  async validateSetting(category: string, key: string, value: any) {
    const settingKey = `${category}.${key}`;
    const setting = this.settings.get(settingKey);

    if (!setting) {
      return { valid: false, message: `Setting ${settingKey} not found` };
    }

    const expectedType = setting.valueType;
    let isValidType = false;

    switch (expectedType) {
      case 'string':
        isValidType = typeof value === 'string';
        break;
      case 'number':
        isValidType = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        isValidType = typeof value === 'boolean';
        break;
      case 'json':
        try { JSON.parse(typeof value === 'string' ? value : JSON.stringify(value)); isValidType = true; } catch { isValidType = false; }
        break;
      default:
        isValidType = true;
    }

    if (!isValidType) {
      return { valid: false, message: `Value must be of type ${expectedType}` };
    }

    // ... custom logic ...
    return { valid: true, message: 'Valid' };
  }

  async resetCategoryToDefaults(category: string) {
    // Find all DB overrides for this category and delete them
    const snapshot = await this.collection.where('category', '==', category).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return await this.getSettingsByCategory(category);
  }

  async exportSettings(format = 'json') {
    const all = await this.getAllSettings();
    if (format === 'json') return JSON.stringify(all, null, 2);
    return ''; // CSV not impl
  }

  async importSettings(settings: any, format = 'json', updatedBy?: string) {
    // implementation omitted for brevity, logic is same just calling updateSetting
    return { imported: [], errors: [] };
  }

  async getCategories() {
    const categories = new Set<string>();
    for (const setting of this.settings.values()) {
      categories.add(setting.category);
    }

    return Array.from(categories).map(category => ({
      name: category,
      label: category.charAt(0).toUpperCase() + category.slice(1),
      count: Array.from(this.settings.values()).filter((s: any) => s.category === category).length,
    }));
  }
}

export default new SettingsService();
