// src/app/login/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Eye,
    EyeOff,
    Loader2,
    ArrowRight,
    Mail,
    Lock,
    KeyRound,
    CheckCircle2,
    X,
    Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { authService } from '@/lib/auth';

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Forgot password modal state
    const [isForgotOpen, setIsForgotOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
    const [forgotError, setForgotError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
            rememberMe: false,
        },
    });

    useEffect(() => {
        if (searchParams.get('reset') === 'success') {
            setSuccessMessage('Your password has been successfully reset! Please sign in with your new password.');
        }
        const prefillEmail = searchParams.get('email');
        if (prefillEmail) {
            setValue('email', prefillEmail, { shouldValidate: true });
        }
    }, [searchParams, setValue]);

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await authService.login({
                email: data.email,
                password: data.password,
                rememberMe: data.rememberMe,
            });
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid email or password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail.trim()) {
            setForgotError('Please enter your email address');
            return;
        }

        setForgotLoading(true);
        setForgotError(null);
        setForgotSuccess(null);

        try {
            const res = await authService.requestPasswordReset(forgotEmail.trim());
            setForgotSuccess(
                `Password reset link has been dispatched to ${forgotEmail.trim()} from noreply@mastersystems.com.pg. Please check your inbox.`
            );
        } catch (err: any) {
            setForgotError(err?.message || 'Failed to send password reset email.');
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-x-hidden">
            {/* Left Column - Dark branding and illustration section */}
            <div className="flex w-full md:w-1/2 bg-zinc-900 flex-col justify-between p-8 md:p-12 min-h-[340px] md:min-h-screen text-white relative overflow-hidden shrink-0">
                {/* Background Image with overlay */}
                <div className="absolute inset-0">
                    <Image
                        src="/assests/loginImage.webp"
                        alt="Branding background"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                {/* Logo top alignment */}
                <div className="relative z-10">
                    <Image
                        src="/assests/image.png"
                        alt="Fuel Master Logo"
                        width={240}
                        height={80}
                        priority
                        className="object-contain h-[56px] md:h-[70px] w-auto"
                    />
                </div>

                {/* Big typography and message block */}
                <div className="relative z-10 space-y-4 md:space-y-6 my-6 md:my-auto max-w-lg">
                    <span className="text-[#f26522] tracking-wider text-[11px] font-extrabold uppercase block">
                        FLEET INTELLIGENCE PLATFORM
                    </span>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.15] text-white">
                        Every litre.<br />
                        <span className="text-white/95">Better managed.</span>
                    </h1>
                    <p className="text-zinc-300 text-xs md:text-sm font-medium leading-relaxed max-w-sm">
                        Bring fuel levels, deliveries and fleet efficiency into one clear operational view.
                    </p>
                </div>

                {/* Bottom status indicator */}
                <div className="relative z-10 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Secure operations dashboard &bull; Master Systems
                </div>
            </div>

            {/* Right Column - Account Sign In form */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-6 py-8 md:py-12 sm:px-16 md:px-20 lg:px-24">
                <div className="w-full max-w-[420px] mx-auto space-y-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 text-[#f26522]">
                            <span className="bg-[#f26522] text-white rounded-full p-0.5 flex items-center justify-center shrink-0">
                                <ArrowRight className="h-2.5 w-2.5" />
                            </span>
                            <span className="text-xs font-bold">Welcome back</span>
                        </div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">
                            Sign in to your account
                        </h2>
                        <p className="text-zinc-400 text-[13px] font-medium">
                            Enter your credentials to access the operational dashboard.
                        </p>
                    </div>

                    {/* Success Notice if password was reset */}
                    {successMessage && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Login Credentials Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                                {error}
                            </div>
                        )}

                        {/* Email address field */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-xs font-bold text-zinc-600 block">
                                Email address
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                                    <Mail className="h-4 w-4" />
                                </span>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email address"
                                    className="w-full rounded-lg border border-zinc-200 bg-white pl-11 pr-4 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-12 shadow-xs"
                                    {...register('email')}
                                />
                            </div>
                            {errors.email && (
                                <p className="text-xs text-red-600 font-semibold">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password field with Forgot Password link */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="text-xs font-bold text-zinc-600 block">
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForgotEmail('');
                                        setForgotSuccess(null);
                                        setForgotError(null);
                                        setIsForgotOpen(true);
                                    }}
                                    className="text-xs font-bold text-[#f26522] hover:text-[#d45316] transition-colors cursor-pointer"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                                    <Lock className="h-4 w-4" />
                                </span>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    className="w-full rounded-lg border border-zinc-200 bg-white pl-11 pr-10 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-12 shadow-xs"
                                    {...register('password')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-red-600 font-semibold">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Remember me row */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center space-x-2 text-xs font-semibold text-zinc-500 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-[#f26522] focus:ring-[#f26522] h-4 w-4 cursor-pointer"
                                    {...register('rememberMe')}
                                />
                                <span>Remember me</span>
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                            >
                                Reset assistance
                            </Link>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-bold h-12 rounded-lg transition-colors duration-200 shadow-sm border border-[#f26522] mt-2 cursor-pointer"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In →'
                            )}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Forgot Password Popup Modal */}
            {isForgotOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative">
                        <button
                            onClick={() => setIsForgotOpen(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 p-1 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-full bg-orange-100 text-[#f26522]">
                                <KeyRound className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900">Reset your password</h3>
                                <p className="text-xs text-zinc-500">We'll send a password recovery link to your inbox.</p>
                            </div>
                        </div>

                        {forgotSuccess && (
                            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>{forgotSuccess}</span>
                            </div>
                        )}

                        {forgotError && (
                            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                                {forgotError}
                            </div>
                        )}

                        {!forgotSuccess && (
                            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-700 block">Your Account Email</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                                            <Mail className="h-4 w-4" />
                                        </span>
                                        <input
                                            type="email"
                                            required
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            placeholder="Enter your registered email"
                                            className="w-full rounded-lg border border-zinc-200 bg-white pl-11 pr-4 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-11 shadow-xs"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2.5 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsForgotOpen(false)}
                                        className="h-10 px-4 text-xs font-semibold"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={forgotLoading}
                                        className="h-10 px-4 bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-bold flex items-center gap-2"
                                    >
                                        {forgotLoading ? (
                                            <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Sending Link...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-3.5 w-3.5" />
                                                Dispatch Reset Link
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {forgotSuccess && (
                            <div className="pt-2 flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setIsForgotOpen(false)}
                                    className="bg-zinc-900 text-white text-xs font-semibold"
                                >
                                    Close
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <Loader2 className="h-8 w-8 animate-spin text-[#f26522]" />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
