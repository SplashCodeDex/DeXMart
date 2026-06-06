/**
 * Auth Feature Module
 *
 * Handles all authentication-related functionality including:
 * - Login/Register forms
 * - Session management
 * - Social authentication
 * - Password reset
 */

// Server Actions
export { requestPasswordReset, resetPassword } from './actions';

// Components
export { LoginForm, ForgotPasswordForm, ResetPasswordForm, InteractiveAuthProgressBar, RegisterForm, AuthTransitionLayout } from './components';

// Hooks
export { useAuth } from './hooks';

// Store

// Schemas
export {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    type LoginInput,
    type RegisterInput,
    type ForgotPasswordInput,
    type ResetPasswordInput,
} from './schemas';

// Types
export type {
    AuthUser,
    Session,
    AuthState,
} from './types';

export { getAuthErrorMessage } from './types';
export * from './utils';
