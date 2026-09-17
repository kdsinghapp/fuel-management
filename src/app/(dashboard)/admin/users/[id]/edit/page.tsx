// src/app/(dashboard)/admin/users/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Edit,
    Mail,
    Building2,
    Check,
    Loader2,
    Shield,
    AlertTriangle,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { userService } from '@/services/userService';
import { authService, hasPermission, PERMISSIONS } from '@/lib/auth';
import { CLIENTS } from '@/services/api';
import { User } from '@/types/common';

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params?.id as string;

    const [user, setUser] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<{
        name: string;
        role: 'Administrator' | 'Manager' | 'Viewer';
        status: 'Active' | 'Inactive';
        assignedClients: string[];
    }>({
        name: '',
        role: 'Viewer',
        status: 'Active',
        assignedClients: [],
    });

    useEffect(() => {
        const load = async () => {
            const isAuth = await authService.isAuthenticated();
            if (!isAuth) {
                router.push('/login');
                return;
            }
            const currUser = await authService.getCurrentUser();
            setCurrentUser(currUser);
            if (!hasPermission(currUser, PERMISSIONS.USERS.MANAGE)) {
                router.push('/admin/users');
                return;
            }

            if (userId) {
                const u = await userService.getUserById(userId);
                if (u) {
                    setUser(u);
                    setForm({
                        name: u.name,
                        role: u.role,
                        status: u.status,
                        assignedClients: u.assignedClients || (u.role === 'Viewer' ? [CLIENTS[0].name] : []),
                    });
                }
            }
            setLoading(false);
        };
        load();
    }, [userId, router]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!form.name.trim()) {
            setError('User name cannot be empty.');
            return;
        }

        if (form.role === 'Viewer' && form.assignedClients.length === 0) {
            setError('Please assign at least one client to this Viewer account.');
            return;
        }

        setIsSubmitting(true);
        try {
            await userService.updateUser(user.id, {
                name: form.name.trim(),
                role: form.role,
                status: form.status,
                assignedClients: form.role === 'Viewer' ? form.assignedClients : undefined,
            });

            router.push('/admin/users?updated=true');
        } catch (err: any) {
            setError(err?.message || 'Failed to update user.');
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#f26522]" />
                </div>
            </PageContainer>
        );
    }

    if (!user) {
        return (
            <PageContainer>
                <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
                    <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                    <h2 className="text-xl font-bold text-slate-800">User Not Found</h2>
                    <Link
                        href="/admin/users"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#f26522] text-white text-xs font-bold rounded-xl"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to User List
                    </Link>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <div className="max-w-4xl mx-auto space-y-5 pb-12">
                {/* Back Link */}
                <div className="flex items-center justify-between">
                    <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#f26522] transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to User Profile
                    </Link>
                </div>

                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                    <div className="bg-[#001b33] px-8 py-6 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Edit className="h-6 w-6 text-[#f26522]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white leading-tight">Edit User: {user.name}</h2>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
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
                            <div className="space-y-4">
                                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-[#f26522]" />
                                    Account Information
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Email Address (Read-only)
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="email"
                                                disabled
                                                value={user.email}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-100 pl-11 pr-4 py-2.5 text-sm font-mono text-slate-500 h-11 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Access Role
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

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Account Status
                                        </label>
                                        <select
                                            value={form.status}
                                            onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f26522]/30 focus:border-[#f26522] h-11 cursor-pointer font-medium"
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Client Access Scope */}
                            {form.role === 'Viewer' && (
                                <div className="space-y-3 pt-2">
                                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-[#f26522]" />
                                            <span>Client Access Permissions ({form.assignedClients.length} Selected)</span>
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

                            <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                                <Link
                                    href={`/admin/users/${user.id}`}
                                    className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-7 py-2.5 text-xs font-bold text-white bg-[#f26522] hover:bg-[#d94f12] rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            Saving Changes...
                                        </>
                                    ) : (
                                        'Save Changes'
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
