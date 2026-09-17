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
    Shield,
    Settings,
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
import { cn } from '@/lib/utils';

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
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
    const [activeRole, setActiveRole] = useState<'admin' | 'manager' | 'viewer'>('admin');

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

    const handleRoleSelect = (role: 'admin' | 'manager' | 'viewer') => {
        setActiveRole(role);
        if (role === 'admin') {
            setValue('email', 'admin@fuelmaster.com', { shouldValidate: true });
            setValue('password', 'admin123', { shouldValidate: true });
        } else if (role === 'manager') {
            setValue('email', 'manager@fuelmaster.com', { shouldValidate: true });
            setValue('password', 'manager123', { shouldValidate: true });
        } else if (role === 'viewer') {
            setValue('email', 'viewer@fuelmaster.com', { shouldValidate: true });
            setValue('password', 'viewer123', { shouldValidate: true });
        }
    };

    // Auto-fill admin credentials on mount and check for reset status query params
    useEffect(() => {
        handleRoleSelect('admin');
        if (searchParams.get('reset') === 'success') {
            setSuccessMessage('Your password has been successfully reset! Please sign in with your new password.');
        }
        const prefillEmail = searchParams.get('email');
        if (prefillEmail) {
            setValue('email', prefillEmail, { shouldValidate: true });
        }
    }, [searchParams]);

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
            setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
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

    const roleLabels = {
        admin: 'Administrator',
        manager: 'Fleet Manager',
        viewer: 'Fleet Viewer',
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
                            Select your access role and credentials to proceed.
                        </p>
                    </div>

                    {/* Success Notice if password was reset */}
                    {successMessage && (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {/* Access Role Selection Cards */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                            SELECT ACCESS ROLE
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Admin Role */}
                            <button
                                type="button"
                                onClick={() => handleRoleSelect('admin')}
                                className={cn(
                                    "flex flex-col items-center justify-center py-3.5 px-3 rounded-xl border text-center transition-all duration-200 gap-2 cursor-pointer shadow-xs",
                                    activeRole === 'admin'
                                        ? "border-[#f26522] bg-[#fff8f5] text-zinc-950 ring-1 ring-[#f26522]"
                                        : "border-zinc-200 bg-[#f8f9fa] hover:bg-zinc-100/80 text-zinc-500"
                                )}
                            >
                                <Shield className={cn("h-5 w-5", activeRole === 'admin' ? "text-[#f26522]" : "text-zinc-400")} />
                                <span className="text-[13px] font-bold">Admin</span>
                            </button>

                            {/* Manager Role */}
                            <button
                                type="button"
                                onClick={() => handleRoleSelect('manager')}
                                className={cn(
                                    "flex flex-col items-center justify-center py-3.5 px-3 rounded-xl border text-center transition-all duration-200 gap-2 cursor-pointer shadow-xs",
                                    activeRole === 'manager'
                                        ? "border-[#f26522] bg-[#fff8f5] text-zinc-950 ring-1 ring-[#f26522]"
                                        : "border-zinc-200 bg-[#f8f9fa] hover:bg-zinc-100/80 text-zinc-500"
                                )}
                            >
                                <Settings className={cn("h-5 w-5", activeRole === 'manager' ? "text-[#f26522]" : "text-zinc-400")} />
                                <span className="text-[13px] font-bold">Manager</span>
                            </button>

                            {/* Viewer Role */}
                            <button
                                type="button"
                                onClick={() => handleRoleSelect('viewer')}
                                className={cn(
                                    "flex flex-col items-center justify-center py-3.5 px-3 rounded-xl border text-center transition-all duration-200 gap-2 cursor-pointer shadow-xs",
                                    activeRole === 'viewer'
                                        ? "border-[#f26522] bg-[#fff8f5] text-zinc-950 ring-1 ring-[#f26522]"
                                        : "border-zinc-200 bg-[#f8f9fa] hover:bg-zinc-100/80 text-zinc-500"
                                )}
                            >
                                <Eye className={cn("h-5 w-5", activeRole === 'viewer' ? "text-[#f26522]" : "text-zinc-400")} />
                                <span className="text-[13px] font-bold">Viewer</span>
                            </button>
                        </div>
                    </div>

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
                                `Sign in as ${roleLabels[activeRole]} →`
                            )}
                        </Button>
                    </form>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* FORGOT PASSWORD MODAL */}
            {/* ========================================================================= */}
            {isForgotOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#f26522] to-[#d45316] px-6 py-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <KeyRound className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-white leading-tight">Reset Password</h3>
                                    <p className="text-xs text-white/80">Dispatched from noreply@mastersystems.com.pg</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsForgotOpen(false)}
                                className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleForgotPasswordSubmit} className="p-6 space-y-4">
                            {forgotSuccess ? (
                                <div className="space-y-4 py-2">
                                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium space-y-2">
                                        <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            Reset Email Dispatched!
                                        </div>
                                        <p className="leading-relaxed">{forgotSuccess}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotOpen(false)}
                                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        Back to Sign In
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Enter your registered email address below. We will send you a secure password reset link to create a new password.
                                    </p>

                                    {forgotError && (
                                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                                            {forgotError}
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 block">
                                            Registered Email Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="email"
                                                required
                                                placeholder="e.g. admin@fuelmaster.com"
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600">
                                        Email will be sent from <strong className="text-slate-900">noreply@mastersystems.com.pg</strong>
                                    </div>

                                    <div className="pt-2 flex items-center justify-end gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setIsForgotOpen(false)}
                                            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="px-5 py-2 text-xs font-bold text-white bg-[#f26522] hover:bg-[#d94f12] rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            {forgotLoading ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                                                    Sending Email...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-3.5 w-3.5" />
                                                    Send Reset Link
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </form>
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
                <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#f26522]" />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
