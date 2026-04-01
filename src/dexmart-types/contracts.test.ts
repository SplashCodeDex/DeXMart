import { describe, it, expect } from 'vitest';
import { ContactSchema, AudienceSchema } from './contracts';

describe('ContactSchema', () => {
  it('validates a valid contact', () => {
    const validContact = {
      id: 'cont_123',
      tenantId: 'tenant_123',
      name: 'John Doe',
      phone: '1234567890',
      email: 'john@example.com',
      attributes: { city: 'New York' },
      tags: ['lead'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = ContactSchema.safeParse(validContact);
    expect(result.success).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    const invalidContact = {
      id: 'cont_123',
      tenantId: 'tenant_123',
      name: 'John Doe',
      phone: '', // Empty phone
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = ContactSchema.safeParse(invalidContact);
    expect(result.success).toBe(false);
  });
});

describe('AudienceSchema', () => {
  it('validates a valid audience', () => {
    const validAudience = {
      id: 'aud_123',
      tenantId: 'tenant_123',
      name: 'VIP Customers',
      description: 'High value clients',
      filters: { tags: ['vip'] },
      count: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = AudienceSchema.safeParse(validAudience);
    expect(result.success).toBe(true);
  });

  it('requires a name', () => {
    const invalidAudience = {
      id: 'aud_123',
      tenantId: 'tenant_123',
      filters: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = AudienceSchema.safeParse(invalidAudience);
    expect(result.success).toBe(false);
  });
});
