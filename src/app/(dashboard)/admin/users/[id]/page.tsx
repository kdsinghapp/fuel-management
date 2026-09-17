// src/app/(dashboard)/admin/users/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Mail,
    KeyRound,
    Edit,
    Building2,
    Check,
    Loader2,
    Shield,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Calendar,
    Send,
    UserCheck,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { userService } from '@/services/userService';
import { authService, hasPermission, PERMISSIONS } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { User } from '@/types/common';

export default function ViewUserPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params?.id as string;

    const [user, setUser] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            const isAuth = await authService.isAuthenticated();
            if (!isAuth) {
                router.push('/login');
                return;
            }
            const currUser = await authService.getCurrentUser();
            setCurrentUser(currUser);

            if (userId) {
                const u = await userService.getUserById(userId);
                setUser(u);
            }
            setLoading(false);
        };
        load();
    }, [userId, router]);

    const handleSendWelcomeEmail = async () => {
        if (!user) return;
        setActionLoading('welcome');
        try {
            const res = await userService.sendWelcomeEmail({
                name: user.name,
                email: user.email,
                role: user.role,
                assignedClients: user.assignedClients,
            });
            if (res.success) {
                setNotification({
                    type: 'success',
                    message: `Welcome & confirmation email successfully sent to ${user.email} from noreply@mastersystems.com.pg`,
                });
            } else {
                setNotification({
                    type: 'info',
                    message: `Welcome email triggered. Notice: ${res.error || 'Dispatched'} (Sender: noreply@mastersystems.com.pg)`,
                });
            }
        } catch (e: any) {
            setNotification({ type: 'error', message: e?.message || 'Failed to send welcome email.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleSendPasswordReset = async () => {
        if (!user) return;
        setActionLoading('reset');
        try {
            const res = await userService.sendPasswordResetEmail(user.email, user.name);
            if (res.success) {
                setNotification({
                    type: 'success',
                    message: `Password reset link successfully dispatched to ${user.email} from noreply@mastersystems.com.pg`,
                });
            } else {
                setNotification({
                    type: 'info',
                    message: res.error
                        ? `Password reset link generated for ${user.email}. Status: ${res.error}`
                        : `Password reset link dispatched to ${user.email} from noreply@mastersystems.com.pg`,
                });
            }
        } catch (e: any) {
            setNotification({ type: 'error', message: e?.message || 'Failed to dispatch reset email.' });
        } finally {
            setActionLoading(null);
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
                    <p className="text-xs text-slate-500">The user you are looking for does not exist or has been removed.</p>
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
                {/* Back Link & Header */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/admin/users"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#f26522] transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to User Management
                    </Link>

                    {hasPermission(currentUser, PERMISSIONS.USERS.MANAGE) && (
                        <Link
                            href={`/admin/users/${user.id}/edit`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                        >
                            <Edit className="h-3.5 w-3.5" />
                            Edit User Profile
                        </Link>
                    )}
                </div>

                {notification && (
                    <div
                        className={`p-4 rounded-xl border flex items-center justify-between shadow-2xs ${
                            notification.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : notification.type === 'error'
                                ? 'bg-red-50 border-red-200 text-red-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 text-xs font-semibold">
                            {notification.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                                <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                            )}
                            <span>{notification.message}</span>
                        </div>
                        <button
                            onClick={() => setNotification(null)}
                            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Profile Card */}
                <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                    {/* Header Banner */}
                    <div className="bg-slate-900 px-8 py-7 text-white flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-[#f26522] text-white flex items-center justify-center font-extrabold text-2xl shadow-md">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white leading-tight">{user.name}</h2>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {user.status === 'Active' ? (
                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-[#e2f5ea] text-[#137e19] border border-[#ceead6]">
                                    <span className="h-2 w-2 rounded-full bg-[#137e19]" />
                                    Active Account
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                                    <span className="h-2 w-2 rounded-full bg-slate-500" />
                                    Inactive Account
                                </span>
                            )}
                        </div>
                    </div>

                    <CardContent className="p-8 space-y-6">
                        {/* Key Specs Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
                            <div>
                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Access Role</div>
                                <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e0f0ff] text-[#0066cc]">
                                        ● {user.role}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Account ID</div>
                                <div className="text-xs font-mono font-semibold text-slate-800 mt-1">#{user.id}</div>
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Created Date</div>
                                <div className="text-xs font-semibold text-slate-800 mt-1">{formatDate(user.createdAt)}</div>
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Last Login</div>
                                <div className="text-xs font-semibold text-slate-800 mt-1">{user.lastLogin || 'Never'}</div>
                            </div>
                        </div>

                        {/* Client Access Scope */}
                        <div className="p-5 border border-slate-200 rounded-2xl bg-white space-y-3">
                            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-[#f26522]" />
                                Client Access Permissions
                            </div>

                            {user.role === 'Viewer' && user.assignedClients && user.assignedClients.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-600">
                                        This Viewer is restricted to access the following <strong>{user.assignedClients.length}</strong> assigned client division(s):
                                    </p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {user.assignedClients.map((client) => (
                                            <span
                                                key={client}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200"
                                            >
                                                <Check className="h-3.5 w-3.5 text-amber-700" />
                                                {client}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                    This user has full operational access to view and monitor all fleet client divisions across the platform.
                                </p>
                            )}
                        </div>

                        {/* Email Operations Box */}
                        {hasPermission(currentUser, PERMISSIONS.USERS.MANAGE) && (
                            <div className="p-5 border border-orange-200 rounded-2xl bg-orange-50/40 space-y-3">
                                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-[#f26522]" />
                                    System Email Operations (Sender: noreply@mastersystems.com.pg)
                                </div>
                                <p className="text-xs text-slate-600">
                                    Trigger automated notification and security emails directly to this user's corporate email address:
                                </p>

                                <div className="flex flex-wrap gap-3 pt-1">
                                    <button
                                        onClick={handleSendWelcomeEmail}
                                        disabled={actionLoading === 'welcome'}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-200 text-slate-800 hover:text-[#f26522] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
                                    >
                                        {actionLoading === 'welcome' ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-[#f26522]" />
                                        ) : (
                                            <Send className="h-4 w-4 text-[#f26522]" />
                                        )}
                                        Resend Welcome / Account Confirmation Email
                                    </button>

                                    <button
                                        onClick={handleSendPasswordReset}
                                        disabled={actionLoading === 'reset'}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-200 text-slate-800 hover:text-[#f26522] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
                                    >
                                        {actionLoading === 'reset' ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-[#f26522]" />
                                        ) : (
                                            <KeyRound className="h-4 w-4 text-[#f26522]" />
                                        )}
                                        Dispatch Password Reset Link
                                    </button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
}
