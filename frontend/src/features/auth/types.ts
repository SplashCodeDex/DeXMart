/**
 * Auth Feature Types
 *
 * TypeScript types for authentication state and operations.
 */

import type { User as FirebaseUser } from 'firebase/auth';

import type { ActionResult } from '@/types/api';

/**
 * Authenticated user data (client-side safe)
 */
export interface AuthUser {
    id: string;
    email: string;
    name: string;
    photoURL?: string | null;
    role?: string;
    tenantId?: string | null;
    plan?: 'starter' | 'pro' | 'enterprise';
    firebaseToken?: string | null;
    token?: string;
    emailVerified?: boolean;
}

/**
 * Session data stored in cookies/tokens
 */
export interface Session {
    user: AuthUser;
    accessToken: string;
    expiresAt: number;
}

/**
 * Auth state for client-side store
 */
export interface AuthState {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;
}

export { ActionResult }; // Re-export for convenience if needed, or just remove AuthResult usages.

/**
 * Firebase auth error codes mapped to user-friendly messages
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Please enter a valid email address',
    'auth/operation-not-allowed': 'This sign-in method is not enabled',
    'auth/weak-password': 'Please choose a stronger password',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Please check your connection',
    'auth/popup-closed-by-user': 'Sign-in was cancelled',
    'auth/requires-recent-login': 'Please sign in again to complete this action',
};

/**
 * Convert Firebase User to AuthUser
 */
function firebaseUserToAuthUser(user: FirebaseUser): AuthUser {
    return {
        id: user.uid,
        email: user.email ?? '',
        name: user.displayName ?? 'User',
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        tenantId: null, // Will be populated from custom claims
    };
}

/**
 * Get user-friendly error message from Firebase auth error
 */
export function getAuthErrorMessage(code: string): string {
    return AUTH_ERROR_MESSAGES[code] ?? 'An unexpected error occurred';
}
