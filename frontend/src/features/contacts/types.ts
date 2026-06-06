import { z } from 'zod';

const ContactSchema = z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string().min(1, "Phone number is required"),
    email: z.string().email().optional().or(z.literal('')),
    attributes: z.record(z.string(), z.any()).optional(),
    tags: z.array(z.string()).default([]),
    createdAt: z.any(), // Handle both Date and Firestore Timestamp
    updatedAt: z.any()
});

export type Contact = z.infer<typeof ContactSchema>;

const AudienceSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    filters: z.record(z.string(), z.any()).default({}),
    count: z.number().default(0),
    createdAt: z.any(),
    updatedAt: z.any()
});

export type Audience = z.infer<typeof AudienceSchema>;

export interface ContactImportResult {
    count: number;
    errors: string[];
}
