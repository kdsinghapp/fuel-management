// src/app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    KeyRound,
    Mail,
    ArrowLeft,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Send,
    ShieldCheck,
} from 'lucide-react';
import { authService } from '@/lib/auth';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const result = await authService.requestPasswordReset(email.trim());
            setSuccessMessage(
                `A password reset link has been dispatched to ${email.trim()} from noreply@mastersystems.com.pg. Please check your inbox and spam folder.`
            );
        } catch (err: any) {
            setError(err?.message || 'Failed to dispatch password reset email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-x-hidden">
            {/* Left Column - Dark branding and illustration */}
            <div className="flex w-full md:w-1/2 bg-zinc-900 flex-col justify-between p-8 md:p-12 min-h-[300px] md:min-h-screen text-white relative overflow-hidden shrink-0">
                <div className="absolute inset-0">
                    <Image
                        src="/assests/loginImage.webp"
                        alt="Branding background"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
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
                        ACCOUNT SECURITY & ACCESS RECOVERY
                    </span>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.15] text-white">
                        Reset your<br />
                        <span className="text-white/95">account password.</span>
                    </h1>
                    <p className="text-zinc-300 text-xs md:text-sm font-medium leading-relaxed max-w-sm">
                        Follow the automated reset instructions delivered directly to your registered corporate email address.
                    </p>
                </div>

                <div className="relative z-10 flex items-center gap-2 text-xs font-semibold text-zinc-400">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Official Notification System &bull; noreply@mastersystems.com.pg
                </div>
            </div>

            {/* Right Column - Forgot Password Form */}
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
                            Forgot Password?
                        </h2>
                        <p className="text-zinc-500 text-[13px] font-medium mt-1 leading-relaxed">
                            Enter the email address associated with your FuelMaster account, and we will send you a secure link to reset your password.
                        </p>
                    </div>

                    {successMessage ? (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                    Password Reset Email Sent!
                                </div>
                                <p className="text-xs text-emerald-900/90 leading-relaxed">
                                    {successMessage}
                                </p>
                                <div className="mt-3 pt-3 border-t border-emerald-200/80 text-[11px] text-emerald-800">
                                    Sender: <strong className="font-mono">noreply@mastersystems.com.pg</strong>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Link
                                    href="/login"
                                    className="w-full flex items-center justify-center bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-bold h-12 rounded-xl transition-all shadow-sm"
                                >
                                    Return to Sign In
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSuccessMessage(null);
                                        setEmail('');
                                    }}
                                    className="w-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold h-11 rounded-xl transition-colors"
                                >
                                    Send to a different email
                                </button>
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

                            <div className="space-y-1.5">
                                <label htmlFor="email" className="text-xs font-bold text-zinc-700 block">
                                    Corporate Email Address
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                                        <Mail className="h-4 w-4" />
                                    </span>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        placeholder="e.g. admin@fuelmaster.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white pl-11 pr-4 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-12 shadow-xs"
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 leading-relaxed">
                                💡 Password reset instructions are sent from <strong className="font-mono text-slate-900">noreply@mastersystems.com.pg</strong> with a single-use secure reset link.
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-bold h-12 rounded-xl transition-all duration-200 shadow-sm border border-[#f26522] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        Dispatching Reset Email...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Send Password Reset Link →
                                    </>
                                )}
                            </button>

                            <div className="text-center pt-2">
                                <Link
                                    href="/login"
                                    className="text-xs text-zinc-500 hover:text-zinc-800 font-semibold transition-colors"
                                >
                                    Remember your password? <span className="text-[#f26522]">Sign In</span>
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
