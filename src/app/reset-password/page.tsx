// src/app/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    Lock,
    Eye,
    EyeOff,
    Check,
    X,
    ArrowLeft,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    KeyRound,
    ShieldCheck,
} from 'lucide-react';
import { authService } from '@/lib/auth';

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const emailParam = searchParams.get('email');
        const tokenParam = searchParams.get('token');
        if (emailParam) setEmail(emailParam);
        if (tokenParam) setToken(tokenParam);
    }, [searchParams]);

    // Password criteria checks
    const criteria = {
        length: newPassword.length >= 8,
        hasUpper: /[A-Z]/.test(newPassword),
        hasLower: /[a-z]/.test(newPassword),
        hasNumber: /[0-9]/.test(newPassword),
        hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    };

    const isStrong = criteria.length && (criteria.hasUpper || criteria.hasLower) && (criteria.hasNumber || criteria.hasSpecial);
    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('Missing email address. Please request a new password reset link.');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await authService.resetPassword(email.trim(), newPassword);
            setSuccess(true);
            setTimeout(() => {
                router.push(`/login?reset=success&email=${encodeURIComponent(email.trim())}`);
            }, 2500);
        } catch (err: any) {
            setError(err?.message || 'Failed to reset password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-x-hidden">
            {/* Left Column - Dark branding and illustration section */}
            <div className="flex w-full md:w-1/2 bg-zinc-900 flex-col justify-between p-8 md:p-12 min-h-[300px] md:min-h-screen text-white relative overflow-hidden shrink-0">
                <div className="absolute inset-0">
                    <Image
                        src="/assests/loginImage.webp"
                        alt="Branding background"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/50" />
                </div>

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

                <div className="relative z-10 space-y-4 my-6 md:my-auto max-w-lg">
                    <span className="text-[#f26522] tracking-wider text-[11px] font-extrabold uppercase block">
                        AUTHENTICATION SECURITY
                    </span>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.15] text-white">
                        Create a strong,<br />
                        <span className="text-white/95">new password.</span>
                    </h1>
                    <p className="text-zinc-300 text-xs md:text-sm font-medium leading-relaxed max-w-sm">
                        Protect your FuelMaster operations account with updated security credentials.
                    </p>
                </div>

                <div className="relative z-10 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Security verification &bull; noreply@mastersystems.com.pg
                </div>
            </div>

            {/* Right Column - Reset Form */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-6 py-8 md:py-12 sm:px-16 md:px-20 lg:px-24 bg-white">
                <div className="w-full max-w-[420px] mx-auto space-y-6">
                    <div>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#f26522] hover:text-[#d45316] transition-colors mb-4"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to Sign In
                        </Link>
                        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">
                            Reset Password
                        </h2>
                        <p className="text-zinc-500 text-[13px] font-medium mt-1">
                            Choose a new password for your FuelMaster account.
                        </p>
                    </div>

                    {success ? (
                        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3 animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 font-bold text-base text-emerald-800">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                                Password Successfully Changed!
                            </div>
                            <p className="text-xs text-emerald-900/90 leading-relaxed">
                                A confirmation notice has been sent to your email from <strong>noreply@mastersystems.com.pg</strong>.
                            </p>
                            <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold pt-2">
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                Redirecting you to Sign In...
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Email field */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 block">
                                    Account Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your account email"
                                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                />
                            </div>

                            {/* New Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 block">
                                    New Password
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                                        <Lock className="h-4 w-4" />
                                    </span>
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        required
                                        placeholder="Enter new password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                    >
                                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Password Strength Checklist */}
                            {newPassword.length > 0 && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                                    <div className="font-bold text-slate-700 mb-1">Password Strength:</div>
                                    <div className="grid grid-cols-2 gap-1 text-slate-600">
                                        <span className={`flex items-center gap-1 ${criteria.length ? 'text-emerald-600 font-bold' : ''}`}>
                                            {criteria.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-slate-400" />}
                                            8+ characters
                                        </span>
                                        <span className={`flex items-center gap-1 ${criteria.hasNumber ? 'text-emerald-600 font-bold' : ''}`}>
                                            {criteria.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-slate-400" />}
                                            Numbers (0-9)
                                        </span>
                                        <span className={`flex items-center gap-1 ${criteria.hasUpper && criteria.hasLower ? 'text-emerald-600 font-bold' : ''}`}>
                                            {criteria.hasUpper && criteria.hasLower ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-slate-400" />}
                                            Mixed case
                                        </span>
                                        <span className={`flex items-center gap-1 ${criteria.hasSpecial ? 'text-emerald-600 font-bold' : ''}`}>
                                            {criteria.hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-slate-400" />}
                                            Symbols (!@#$)
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 block">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                                        <Lock className="h-4 w-4" />
                                    </span>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required
                                        placeholder="Re-enter new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {confirmPassword.length > 0 && !passwordsMatch && (
                                    <p className="text-[11px] text-red-600 font-semibold">Passwords do not match.</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || (confirmPassword.length > 0 && !passwordsMatch)}
                                className="w-full bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-bold h-12 rounded-xl transition-all duration-200 shadow-sm border border-[#f26522] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        Updating Password...
                                    </>
                                ) : (
                                    <>
                                        <KeyRound className="h-4 w-4" />
                                        Save New Password & Sign In
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
