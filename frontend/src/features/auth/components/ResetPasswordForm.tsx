'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import React, { useActionState, useEffect } from 'react';

import { Button, PasswordInput } from '@/components/ui';
import { resetPassword } from '../actions';
import { getAuthErrorMessage } from '../types';

/**
 * ResetPasswordForm
 * Component for users to enter their new password after clicking a reset link.
 */
export function ResetPasswordForm(): React.JSX.Element {
    const searchParams = useSearchParams();
    const router = useRouter();

    const oobCode = searchParams.get('oobCode') || searchParams.get('code');

    const [state, formAction, isPending] = useActionState(resetPassword, null);

    useEffect(() => {
        if (!state?.success) return;

        const timer = setTimeout(() => {
            router.push('/login');
        }, 3000);
        return () => clearTimeout(timer);
    }, [state?.success, router]);

    if (!oobCode) {
        return (
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                        <AlertCircle className="h-10 w-10" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Invalid Link</h1>
                    <p className="text-sm text-muted-foreground">
                        This password reset link is invalid or has expired. Please request a new one.
                    </p>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/forgot-password">
                            Forgot Password
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <AnimatePresence mode="wait">
                {!state?.success ? (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        <div className="flex flex-col space-y-2 text-center">
                            <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
                            <p className="text-sm text-muted-foreground">
                                Choose a strong password to protect your account
                            </p>
                        </div>

                        <form action={formAction}>
                            <input type="hidden" name="oobCode" value={oobCode} />
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <label
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        htmlFor="password"
                                    >
                                        New Password
                                    </label>
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        disabled={isPending}
                                        required
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <label
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        htmlFor="confirmPassword"
                                    >
                                        Confirm Password
                                    </label>
                                    <PasswordInput
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        disabled={isPending}
                                        required
                                        placeholder="••••••••"
                                    />
                                </div>

                                {state?.error ? <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                                        {state.error.message || getAuthErrorMessage(state.error.code)}
                                    </div> : null}

                                <Button disabled={isPending}>
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Reset Password
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center space-y-4 text-center py-4"
                    >
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <h2 className="text-xl font-semibold">Password updated</h2>
                        <p className="text-sm text-muted-foreground">
                            Your password has been successfully reset. You can now log in with your new password.
                        </p>
                        <p className="text-xs text-muted-foreground animate-pulse">
                            Redirecting to login...
                        </p>
                        <Button className="w-full" asChild variant="outline">
                            <Link href="/login">
                                Login Now
                            </Link>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
