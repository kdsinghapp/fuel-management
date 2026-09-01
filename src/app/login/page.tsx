// src/app/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Shield, Settings, ArrowRight, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { authService } from '@/lib/auth';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeRole, setActiveRole] = useState<'admin' | 'manager' | 'viewer'>('admin');

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

    // Auto-fill admin credentials on mount
    useEffect(() => {
        handleRoleSelect('admin');
    }, []);

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setError(null);

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
                    {/* Dark overlay with some opacity to ensure text contrast */}
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
                    Secure operations dashboard
                </div>
            </div>

            {/* Right Column - Account Sign In form */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-6 py-8 md:py-12 sm:px-16 md:px-20 lg:px-24">
                <div className="w-full max-w-[400px] mx-auto space-y-6">
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
                                        ? "border-[#f26522] bg-[#fff8f5] text-zinc-950"
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
                                        ? "border-[#f26522] bg-[#fff8f5] text-zinc-950"
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
                                        ? "border-[#f26522] bg-[#fff8f5] text-zinc-950"
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

                        {/* Password field */}
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-xs font-bold text-zinc-600 block">
                                Password
                            </label>
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
                        <div className="flex items-center pt-1">
                            <label className="flex items-center space-x-2 text-xs font-semibold text-zinc-500 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded border-zinc-300 text-[#f26522] focus:ring-[#f26522] h-4 w-4 cursor-pointer"
                                    {...register('rememberMe')}
                                />
                                <span>Remember me</span>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-bold h-12 rounded-lg transition-colors duration-200 shadow-sm border border-[#f26522] mt-2"
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
        </div>
    );
}
