/**
 * Auth Validation Schemas
 *
 * Zod schemas for validating authentication inputs.
 * Used in both client-side forms and Server Actions.
 */

import { z } from 'zod';

/**
 * Email validation - reusable across forms
 */
const emailSchema = z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address');

/**
 * Password validation - enforces security requirements
 */
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Login form schema
 */
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Registration form schema
 */
export const registerSchema = z.object({
    firstName: z
        .string()
        .min(1, 'First name is required')
        .max(50, 'First name is too long'),
    lastName: z
        .string()
        .min(1, 'Last name is required')
        .max(50, 'Last name is too long'),
    email: emailSchema,
    password: passwordSchema,
    acceptTerms: z.boolean().refine((val) => val === true, {
        message: 'You must accept the terms and conditions',
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Password reset request schema
 */
export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Password reset confirmation schema
 */
export const resetPasswordSchema = z
    .object({
        password: passwordSchema,
        confirmPassword: z.string().min(1, 'Please confirm your password'),
        oobCode: z.string().min(1, 'Invalid reset code'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
