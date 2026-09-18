// src/app/admin/users/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    Search,
    Download,
    AlertTriangle,
    RefreshCw,
    Eye,
    Edit,
    UserPlus,
    Trash2,
    RotateCcw,
    Mail,
    KeyRound,
    CheckCircle2,
    X,
    Building2,
    Loader2,
    UserX,
    UserCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { userService } from '@/services/userService';
import { authService, hasPermission, PERMISSIONS } from '@/lib/auth';
import { formatDate, exportToCSV } from '@/lib/utils';
import { User } from '@/types/common';

function UsersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Toast notification state
    const [toastNotification, setToastNotification] = useState<{
        type: 'success' | 'error' | 'info';
        message: string;
        details?: string;
    } | null>(null);

    // Action button state for password reset
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Delete user modal state
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
            const user = await authService.getCurrentUser();
            setCurrentUser(user);
            if (!hasPermission(user, PERMISSIONS.USERS.VIEW)) {
                router.push('/dashboard');
                return;
            }
            loadData();
        };
        checkAuth();
    }, [router, page]);

    // Check query params for redirected feedback
    useEffect(() => {
        if (searchParams.get('created') === 'true') {
            showToast(
                'success',
                'User account successfully created!',
                'Confirmation email dispatched to user from noreply@mastersystems.com.pg'
            );
        } else if (searchParams.get('updated') === 'true') {
            showToast('success', 'User account successfully updated!');
        }
    }, [searchParams]);

    const showToast = (type: 'success' | 'error' | 'info', message: string, details?: string) => {
        setToastNotification({ type, message, details });
        setTimeout(() => {
            setToastNotification((prev) => (prev?.message === message ? null : prev));
        }, 6000);
    };

    const loadData = async (overrideSearch?: string) => {
        try {
            setLoading(true);
            const response = await userService.getUsers({
                page,
                pageSize,
                search: overrideSearch !== undefined ? overrideSearch || undefined : search || undefined,
            });
            setUsers(response.data);
            setTotal(response.total);
            setTotalPages(response.totalPages);
            setError(null);
        } catch (err) {
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        loadData();
    };

    const handleReset = () => {
        setSearch('');
        setPage(1);
        loadData('');
    };

    const handleExport = async () => {
        try {
            const response = await userService.getUsers({
                page: 1,
                pageSize: 100000,
                search: search || undefined,
            });
            const allUsers = response.data;
            if (allUsers.length === 0) return;
            const headers = ['Name', 'Email', 'Role', 'Status', 'Assigned Clients', 'Created Date'];
            const rows = allUsers.map(user => [
                user.name,
                user.email,
                user.role,
                user.status,
                user.assignedClients ? user.assignedClients.join('; ') : 'All Clients',
                formatDate(user.createdAt)
            ]);
            exportToCSV('users_list.csv', headers, rows);
            showToast('success', 'User list exported successfully!');
        } catch (err) {
            console.error('Failed to export users:', err);
            showToast('error', 'Failed to export user list.');
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        try {
            await userService.updateUser(userId, { status: newStatus as 'Active' | 'Inactive' });
            showToast('info', `User status updated to ${newStatus}.`);
            loadData();
        } catch {
            showToast('error', 'Failed to update user status.');
        }
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            const success = await userService.deleteUser(userToDelete.id);
            if (success) {
                showToast('success', `User "${userToDelete.name}" permanently deleted.`);
                setUserToDelete(null);
                loadData();
            } else {
                showToast('error', 'Failed to delete user from database.');
            }
        } catch (err: any) {
            showToast('error', 'Error deleting user', err?.message);
        } finally {
            setDeleting(false);
        }
    };

    const handleSendPasswordReset = async (user: User) => {
        setActionLoadingId(`reset-${user.id}`);
        try {
            const result = await userService.sendPasswordResetEmail(user.email, user.name);
            if (result.success) {
                showToast(
                    'success',
                    `Password reset link sent to ${user.email}`,
                    'Sender: noreply@mastersystems.com.pg'
                );
            } else {
                showToast(
                    'info',
                    `Password reset link triggered for ${user.email}`,
                    result.error ? `Notice: ${result.error}` : 'Sender: noreply@mastersystems.com.pg'
                );
            }
        } catch (err: any) {
            showToast('error', 'Failed to send password reset email', err?.message);
        } finally {
            setActionLoadingId(null);
        }
    };

    if (loading && users.length === 0) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center min-h-[400px]">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <p className="text-lg text-muted-foreground">{error}</p>
                    <Button onClick={() => loadData()}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            {/* Top Toast Banner */}
            {toastNotification && (
                <div
                    className={`mb-4 p-4 rounded-xl border flex items-start justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${
                        toastNotification.type === 'success'
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                            : toastNotification.type === 'error'
                            ? 'bg-red-50/90 border-red-200 text-red-900'
                            : 'bg-blue-50/90 border-blue-200 text-blue-900'
                    }`}
                >
                    <div className="flex items-start gap-3">
                        {toastNotification.type === 'success' ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                        ) : toastNotification.type === 'error' ? (
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        ) : (
                            <Mail className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                            <div className="text-sm font-bold">{toastNotification.message}</div>
                            {toastNotification.details && (
                                <div className="text-xs opacity-90 mt-0.5">{toastNotification.details}</div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setToastNotification(null)}
                        className="text-zinc-400 hover:text-zinc-600 p-1 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Header Action Bar with Link to /admin/users/create */}
            <div className="flex justify-end items-center mb-4">
                <div className="flex gap-2">
                    {hasPermission(currentUser, PERMISSIONS.USERS.MANAGE) && (
                        <Link
                            href="/admin/users/create"
                            className="bg-[#f26522] hover:bg-[#d45316] text-xs font-semibold rounded px-3.5 py-1.5 flex items-center gap-1.5 transition-all duration-200 border border-[#f26522] h-8 shadow-xs text-white cursor-pointer"
                        >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add User
                        </Link>
                    )}
                </div>
            </div>

            {/* Users Table Card */}
            <Card className="flex-1 flex flex-col rounded-xl border border-slate-200 shadow-sm p-3 bg-white">
                <CardContent className="flex-1 flex flex-col px-0 pb-2">
                    {/* Search and Filters matching standard fuel dashboard filter bar */}
                    <div className="mb-2 py-1.5 px-3 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-visible">
                        <div className="flex flex-wrap items-end justify-between gap-2.5">
                            {/* Left Filters Group */}
                            <div className="flex flex-wrap items-end gap-2.5 shrink-0">
                                {/* Users Count Summary */}
                                <div className="flex flex-col gap-1 shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Users</label>
                                    <div className="flex items-center px-3 border border-slate-200 bg-white rounded h-8 shadow-xs">
                                        <span className="text-xs font-bold text-[#138024] whitespace-nowrap">
                                            {total} Users
                                        </span>
                                    </div>
                                </div>

                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1 w-[200px] sm:w-[240px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Search Users</label>
                                    <div className="flex h-8">
                                        <span className="flex items-center px-2.5 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                            <Search className="h-3 w-3" />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search by name or email..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            className="w-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Action Buttons Group */}
                            <div className="flex items-end gap-1.5 shrink-0">
                                <Button
                                    onClick={handleSearch}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-3.5 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    Search
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-8 px-3.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
                                    title="Reset filters"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reset
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleExport}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-3.5 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Export
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="flex-1 overflow-x-auto border border-slate-200 shadow-xs rounded mb-2">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    <th className="bg-[#f26522] text-white py-2.5 px-3 text-left font-semibold">Name</th>
                                    <th className="bg-[#137e19] text-white py-2.5 px-3 text-left font-semibold">Email</th>
                                    <th className="bg-[#137e19] text-white py-2.5 px-3 text-left font-semibold">Role</th>
                                    <th className="bg-[#137e19] text-white py-2.5 px-3 text-left font-semibold">Status</th>
                                    <th className="bg-[#137e19] text-white py-2.5 px-3 text-left font-semibold">Client Access</th>
                                    <th className="bg-[#001b33] text-white py-2.5 px-3 text-left font-semibold">Last Login</th>
                                    <th className="bg-[#001b33] text-white py-2.5 px-3 text-left font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="border-b border-slate-200 last:border-0 odd:bg-white even:bg-[#fff9f5] hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="py-2.5 px-3 font-bold text-slate-900 align-middle">
                                                <Link href={`/admin/users/${user.id}`} className="hover:text-[#f26522] transition-colors">
                                                    {user.name}
                                                </Link>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-700 align-middle font-mono text-xs">{user.email}</td>
                                            <td className="py-2.5 px-3 align-middle">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f0ff] text-[#0066cc]">
                                                    <span className="text-[#3b82f6] font-bold mr-0.5">•</span> {user.role}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 align-middle">
                                                {user.status === 'Active' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#e2f5ea] text-[#137e19]">
                                                        <span className="text-[#137e19] font-bold mr-0.5">•</span> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f1f3f5] text-[#777777]">
                                                        <span className="text-[#777777] font-bold mr-0.5">•</span> Inactive
                                                    </span>
                                                )}
                                            </td>
                                            {/* Client Access Column */}
                                            <td className="py-2.5 px-3 align-middle">
                                                {user.role === 'Viewer' && user.assignedClients && user.assignedClients.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                                                        {user.assignedClients.slice(0, 2).map((c) => (
                                                            <span key={c} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                                                {c}
                                                            </span>
                                                        ))}
                                                        {user.assignedClients.length > 2 && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                                                +{user.assignedClients.length - 2} more
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                                        <Building2 className="h-3 w-3 text-slate-400" />
                                                        All Clients
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-700 align-middle text-xs">{user.lastLogin || 'Never'}</td>
                                            <td className="py-2.5 px-3 align-middle">
                                                <div className="flex gap-2.5 justify-start items-center">
                                                    {/* View User dedicated page */}
                                                    <Link
                                                        href={`/admin/users/${user.id}`}
                                                        title="View Details"
                                                        className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded hover:bg-slate-100"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>

                                                    {hasPermission(currentUser, PERMISSIONS.USERS.MANAGE) && (
                                                        <>
                                                            {/* Edit User dedicated page */}
                                                            <Link
                                                                href={`/admin/users/${user.id}/edit`}
                                                                title="Edit User & Client Permissions"
                                                                className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded hover:bg-slate-100"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Link>

                                                            {/* Send Password Reset Email */}
                                                            <button
                                                                title="Send Password Reset Email (from noreply@mastersystems.com.pg)"
                                                                onClick={() => handleSendPasswordReset(user)}
                                                                disabled={actionLoadingId === `reset-${user.id}`}
                                                                className="text-slate-400 hover:text-[#f26522] transition-colors p-1 rounded hover:bg-orange-50 disabled:opacity-50 cursor-pointer"
                                                            >
                                                                {actionLoadingId === `reset-${user.id}` ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin text-[#f26522]" />
                                                                ) : (
                                                                    <KeyRound className="h-4 w-4" />
                                                                )}
                                                            </button>

                                                            {/* Toggle Status (Deactivate / Activate) */}
                                                            <button
                                                                title={user.status === 'Active' ? 'Deactivate User' : 'Reactivate User'}
                                                                onClick={() => handleToggleStatus(user.id, user.status)}
                                                                className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer"
                                                            >
                                                                {user.status === 'Active' ? (
                                                                    <UserX className="h-4 w-4 text-amber-500 hover:text-amber-600" />
                                                                ) : (
                                                                    <UserCheck className="h-4 w-4 text-emerald-500 hover:text-emerald-600" />
                                                                )}
                                                            </button>

                                                            {/* Delete User (Permanent Azure SQL deletion) */}
                                                            <button
                                                                title="Permanently Delete User"
                                                                onClick={() => setUserToDelete(user)}
                                                                className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50 cursor-pointer"
                                                            >
                                                                <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-auto pt-4 px-6 shrink-0">
                            <p className="text-sm text-slate-500">
                                Showing {users.length} of {total} users
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    Previous
                                </Button>
                                <span className="flex items-center px-3 text-sm text-slate-600 font-medium">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Modal */}
            {userToDelete && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-full bg-red-100 text-red-600 shrink-0">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Delete User Account</h3>
                                <p className="text-xs text-slate-500">This action is permanent and cannot be undone.</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                            Are you sure you want to permanently delete <strong className="text-slate-900">{userToDelete.name}</strong> (<span className="font-mono text-slate-700">{userToDelete.email}</span>)?
                        </p>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setUserToDelete(null)}
                                disabled={deleting}
                                className="h-9 px-4 text-xs font-semibold cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Confirm Delete
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}

export default function UsersPage() {
    return (
        <Suspense
            fallback={
                <PageContainer>
                    <div className="flex h-64 items-center justify-center">
                        <LoadingSpinner size="lg" />
                    </div>
                </PageContainer>
            }
        >
            <UsersContent />
        </Suspense>
    );
}