'use server';

/**
 * Auth Server Actions
 *
 * Server-side authentication operations using Firebase Admin SDK.
 * These are called from client components via Server Actions.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from './schemas';
import type { AuthUser } from './types';

import { api, API_ENDPOINTS } from '@/lib/api';
import { ROUTES } from '@/lib/constants';
import { logger } from '@/lib/logger';
import type { ActionResult } from '@/types/api';

// Session cookie configuration (Must match backend expectation)
const SESSION_COOKIE_NAME = 'token';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (Sync with Backend)

/**
 * Sign in with email and password
 */
export async function signIn(
    prevState: ActionResult<AuthUser> | null,
    formData: FormData
): Promise<ActionResult<AuthUser>> {
    // Parse and validate input
    const rawData = {
        email: formData.get('email'),
        password: formData.get('password'),
        rememberMe: formData.get('rememberMe') === 'on',
    };

    const parsed = loginSchema.safeParse(rawData);

    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return {
            success: false,
            error: {
                code: 'validation_error',
                message: firstIssue?.message ?? 'Invalid input',
                details: {
                    field: firstIssue?.path[0] as string,
                    fields: rawData // Return back fields
                },
            },
        };
    }

    const { email, password, rememberMe } = parsed.data;

    try {
        // Authenticate with Backend API via centralized client
        const response = await api.post<{ user: AuthUser; token: string }>(
            API_ENDPOINTS.AUTH.LOGIN,
            { email, password }
        );

        if (!response.success) {
            return {
                success: false,
                error: {
                    ...response.error,
                    details: {
                        ...response.error.details,
                        fields: { email, rememberMe } // Return fields on API error too
                    }
                },
            };
        }

        const { user, token } = response.data;

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE,
            path: '/',
        });

        return {
            success: true,
            data: user,
            message: 'Signed in successfully',
        };
    } catch (err) {
        logger.error('Sign in error:', { error: err });
        return {
            success: false,
            error: {
                code: 'network_error',
                message: 'Unable to connect. Please try again.',
                details: {
                    fields: {
                        email: formData.get('email'),
                        rememberMe: formData.get('rememberMe') === 'on'
                    }
                }
            },
        };
    }
}

/**
 * Register a new account
 */
export async function signUp(
    prevState: ActionResult<AuthUser> | null,
    formData: FormData
): Promise<ActionResult<AuthUser>> {
    // Parse and validate input
    const rawData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        password: formData.get('password'),
        acceptTerms: formData.get('acceptTerms') === 'on',
    };

    const parsed = registerSchema.safeParse(rawData);

    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return {
            success: false,
            error: {
                code: 'validation_error',
                message: firstIssue?.message ?? 'Invalid input',
                details: {
                    field: firstIssue?.path[0] as string,
                    fields: rawData
                },
            },
        };
    }

    const { firstName, lastName, email, password, acceptTerms } = parsed.data;

    try {
        // Register with Backend API via centralized client
        const response = await api.post<{ user: AuthUser; token: string }>(
            API_ENDPOINTS.AUTH.REGISTER,
            {
                firstName,
                lastName,
                email,
                password,
            }
        );

        if (!response.success) {
            return {
                success: false,
                error: {
                    ...response.error,
                    details: {
                        ...response.error.details,
                        fields: { firstName, lastName, email, acceptTerms }
                    }
                },
            };
        }

        const { user, token } = response.data;

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE,
            path: '/',
        });

        return {
            success: true,
            data: user,
            message: 'Account created successfully',
        };
    } catch (err) {
        logger.error('Sign up error:', { error: err });
        return {
            success: false,
            error: {
                code: 'network_error',
                message: 'Unable to connect to registration service.',
                details: {
                    fields: {
                        firstName: formData.get('firstName'),
                        lastName: formData.get('lastName'),
                        email: formData.get('email'),
                        acceptTerms: formData.get('acceptTerms') === 'on'
                    }
                }
            },
        };
    }
}

/**
 * Sign in or sign up with Google
 */
export async function googleAuthAction(
    idToken: string
): Promise<ActionResult<AuthUser>> {
    if (!idToken) {
        return {
            success: false,
            error: {
                code: 'validation_error',
                message: 'Google ID Token is missing',
            },
        };
    }

    try {
        // Authenticate with Backend API
        const response = await api.post<{ user: AuthUser; token: string }>(
            API_ENDPOINTS.AUTH.GOOGLE,
            { idToken }
        );

        if (!response.success) {
            return {
                success: false,
                error: response.error,
            };
        }

        const { user, token } = response.data;

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE,
            path: '/',
        });

        return {
            success: true,
            data: user,
            message: 'Successfully authenticated with Google',
        };
    } catch (err) {
        logger.error('Google Auth error:', { error: err });
        return {
            success: false,
            error: {
                code: 'network_error',
                message: 'Unable to connect to authentication service.',
            },
        };
    }
}

/**
 * Sign out and clear session
 */
async function signOut(): Promise<void> {
    // Best-effort: notify backend to blacklist the token before clearing the cookie.
    // Non-fatal — cookie is deleted regardless; token expires naturally if this fails.
    try {
        await api.post(API_ENDPOINTS.AUTH.LOGOUT, {});
    } catch {
        logger.warn('[signOut] Backend logout call failed; proceeding with cookie deletion.');
    }
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
    redirect(ROUTES.LOGIN);
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(
    prevState: ActionResult | null,
    formData: FormData
): Promise<ActionResult> {
    const rawData = {
        email: formData.get('email'),
    };

    const parsed = forgotPasswordSchema.safeParse(rawData);

    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return {
            success: false,
            error: {
                code: 'validation_error',
                message: firstIssue?.message ?? 'Invalid email',
                details: {
                    fields: rawData
                }
            },
        };
    }

    try {
        await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
            email: parsed.data.email,
        });

        // Always return success to prevent email enumeration
        return {
            success: true,
            data: undefined,
            message: 'If an account exists, a password reset email has been sent',
        };
    } catch (err) {
        logger.error('Password reset error:', { error: err });
        return {
            success: true,
            data: undefined,
            message: 'If an account exists, a password reset email has been sent',
        };
    }
}

/**
 * Get current session from cookie
 */
async function getSession(): Promise<AuthUser | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
        return null;
    }

    try {
        // Verify session with Backend API via centralized client
        // The client automatically attaches the cookie/header if called on server
        const response = await api.get<{ user: AuthUser }>(API_ENDPOINTS.AUTH.VERIFY);

        if (!response.success) {
            return null;
        }

        return response.data.user;
    } catch {
        return null;
    }
}

/**
 * Confirm password reset with code
 */
export async function resetPassword(
    prevState: ActionResult | null,
    formData: FormData
): Promise<ActionResult> {
    const rawData = {
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
        oobCode: formData.get('oobCode'),
    };

    const parsed = resetPasswordSchema.safeParse(rawData);

    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return {
            success: false,
            error: {
                code: 'validation_error',
                message: firstIssue?.message ?? 'Invalid input',
                details: { field: firstIssue?.path[0] as string },
            },
        };
    }

    try {
        const response = await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
            password: parsed.data.password,
            oobCode: parsed.data.oobCode,
        });

        if (!response.success) {
            return {
                success: false,
                error: response.error,
            };
        }

        return {
            success: true,
            data: undefined,
            message: 'Password reset successfully',
        };
    } catch (err) {
        logger.error('Password reset confirmation error:', { error: err });
        return {
            success: false,
            error: {
                code: 'network_error',
                message: 'Unable to reset password. Link may have expired.',
            },
        };
    }
}
