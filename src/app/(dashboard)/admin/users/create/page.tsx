// src/app/(dashboard)/admin/users/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    UserPlus,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Building2,
    Check,
    Loader2,
    Shield,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { userService } from '@/services/userService';
import { authService, hasPermission, PERMISSIONS } from '@/lib/auth';
import { CLIENTS } from '@/services/api';

export default function CreateUserPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    const [form, setForm] = useState<{
        name: string;
        email: string;
        role: 'Administrator' | 'Manager' | 'Viewer';
        status: 'Active' | 'Inactive';
        assignedClients: string[];
        tempPassword: string;
        sendNotificationEmail: boolean;
    }>({
        name: '',
        email: '',
        role: 'Viewer',
        status: 'Active',
        assignedClients: [CLIENTS[0].name],
        tempPassword: 'Password@2026!',
        sendNotificationEmail: true,
    });

    const [showTempPassword, setShowTempPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const isAuth = await authService.isAuthenticated();
            if (!isAuth) {
                router.push('/login');
                return;
            }
            const user = await authService.getCurrentUser();
            setCurrentUser(user);
            if (!hasPermission(user, PERMISSIONS.USERS.MANAGE)) {
                router.push('/admin/users');
                return;
            }
            setIsLoadingAuth(false);
        };
        checkAuth();
    }, [router]);

    const toggleClient = (clientName: string) => {
        setForm(prev => {
            const exists = prev.assignedClients.includes(clientName);
            if (exists) {
                return { ...prev, assignedClients: prev.assignedClients.filter(c => c !== clientName) };
            } else {
                return { ...prev, assignedClients: [...prev.assignedClients, clientName] };
            }
        });
    };

    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
        let pass = '';
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setForm(prev => ({ ...prev, tempPassword: pass }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!form.name.trim() || !form.email.trim()) {
            setError('Please enter a valid user name and email address.');
            return;
        }

        if (form.role === 'Viewer' && form.assignedClients.length === 0) {
            setError('Please assign at least one client to this Viewer account.');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await userService.createUser({
                name: form.name.trim(),
                email: form.email.trim(),
                role: form.role,
                status: form.status,
                assignedClients: form.role === 'Viewer' ? form.assignedClients : undefined,
                tempPassword: form.tempPassword,
                sendNotificationEmail: form.sendNotificationEmail,
            });

            router.push('/admin/users?created=true');
        } catch (err: any) {
            setError(err?.message || 'Failed to create user account.');
            setIsSubmitting(false);
        }
    };

    if (isLoadingAuth) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#f26522]" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <div className="max-w-4xl mx-auto space-y-5 pb-12">
                {/* Back Link & Header */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/admin/users"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#f26522] transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to User Management
                    </Link>
                </div>

                {/* Main Form Card */}
                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-[#f26522] to-[#d45316] px-8 py-6 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs">
                                <UserPlus className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white leading-tight">Create New User Account</h2>
                                <p className="text-xs text-white/80 mt-0.5">
                                    Configure user profile, role permissions, client access scope, and dispatch automated confirmation email
                                </p>
                            </div>
                        </div>
                    </div>

                    <CardContent className="p-8">
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Section 1: User Profile Details */}
                            <div className="space-y-4">
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-[#f26522]" />
                                    1. Basic Account Information
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Full Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g. John Doe"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                        />
                                    </div>

                                    {/* Email Address */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Corporate Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="email"
                                                required
                                                placeholder="e.g. user@mastersystems.com.pg"
                                                value={form.email}
                                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                                    {/* Role */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            System Access Role
                                        </label>
                                        <select
                                            value={form.role}
                                            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11 cursor-pointer font-medium"
                                        >
                                            <option value="Viewer">Viewer (Specific Client Access Scope)</option>
                                            <option value="Manager">Manager (Operational Access)</option>
                                            <option value="Administrator">Administrator (Full Access)</option>
                                        </select>
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Initial Status
                                        </label>
                                        <select
                                            value={form.status}
                                            onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11 cursor-pointer font-medium"
                                        >
                                            <option value="Active">Active (Permitted to Log In)</option>
                                            <option value="Inactive">Inactive (Suspended)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Client Access Scope (for Viewers) */}
                            {form.role === 'Viewer' && (
                                <div className="space-y-3 pt-2">
                                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-[#f26522]" />
                                            <span>2. Client Access Scope ({form.assignedClients.length} Selected)</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setForm(prev => ({ ...prev, assignedClients: CLIENTS.map(c => c.name) }))}
                                                className="text-xs font-bold text-[#f26522] hover:underline cursor-pointer"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button
                                                type="button"
                                                onClick={() => setForm(prev => ({ ...prev, assignedClients: [] }))}
                                                className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-orange-50/40 border border-orange-200 rounded-2xl space-y-3">
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            This Viewer account will be strictly restricted to only view dashboards, fuel levels, deliveries, and transactions for the chosen clients:
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-white p-3.5 rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
                                            {CLIENTS.map((client) => {
                                                const isSelected = form.assignedClients.includes(client.name);
                                                return (
                                                    <label
                                                        key={client.name}
                                                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs font-medium transition-all ${
                                                            isSelected
                                                                ? 'bg-orange-50 text-[#f26522] font-bold border border-orange-200 shadow-2xs'
                                                                : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleClient(client.name)}
                                                            className="rounded border-slate-300 text-[#f26522] focus:ring-[#f26522] h-4 w-4 cursor-pointer"
                                                        />
                                                        <span className="truncate">{client.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 3: Credentials & Automated Email */}
                            <div className="space-y-4 pt-2">
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-[#f26522]" />
                                    {form.role === 'Viewer' ? '3.' : '2.'} Password & Notification Settings
                                </div>

                                {/* Password field */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Initial / Temporary Password
                                        </label>
                                        <button
                                            type="button"
                                            onClick={generateRandomPassword}
                                            className="text-xs font-bold text-[#f26522] hover:underline cursor-pointer"
                                        >
                                            Generate Strong Password
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type={showTempPassword ? 'text' : 'password'}
                                            value={form.tempPassword}
                                            onChange={(e) => setForm({ ...form, tempPassword: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowTempPassword(!showTempPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Automated Welcome Email Checkbox */}
                                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.sendNotificationEmail}
                                            onChange={(e) => setForm({ ...form, sendNotificationEmail: e.target.checked })}
                                            className="mt-0.5 rounded border-amber-300 text-[#f26522] focus:ring-[#f26522] h-4 w-4 cursor-pointer"
                                        />
                                        <div>
                                            <div className="text-xs font-bold text-amber-950">
                                                Send automated confirmation & credentials email to user
                                            </div>
                                            <div className="text-xs text-amber-800/90 leading-relaxed mt-0.5">
                                                Upon creation, the user will automatically receive a welcome email with their login credentials, assigned role, client access scope, and secure portal link sent from <strong className="font-mono text-amber-950">noreply@mastersystems.com.pg</strong>.
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Form Action Buttons */}
                            <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                                <Link
                                    href="/admin/users"
                                    className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-7 py-2.5 text-xs font-bold text-white bg-[#f26522] hover:bg-[#d94f12] rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:shadow"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            Creating User & Dispatching Email...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="h-4 w-4" />
                                            Create User Account
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
}
