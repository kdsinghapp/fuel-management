// src/app/admin/users/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    Download,
    AlertTriangle,
    RefreshCw,
    Eye,
    Edit,
    UserPlus,
    Trash2,
    RotateCw,
    RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { userService } from '@/services/userService';
import { authService, hasPermission, PERMISSIONS } from '@/lib/auth';
import { formatDate, exportToCSV } from '@/lib/utils';
import { User } from '@/types/common';

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [currentUser, setCurrentUser] = useState<any>(null);

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
            const headers = ['Name', 'Email', 'Role', 'Status'];
            const rows = allUsers.map(user => [
                user.name,
                user.email,
                user.role,
                user.status
            ]);
            exportToCSV('users_list.csv', headers, rows);
        } catch (err) {
            console.error('Failed to export users:', err);
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        try {
            await userService.updateUser(userId, { status: newStatus as 'Active' | 'Inactive' });
            loadData();
        } catch {
            setError('Failed to update user status');
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
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="font-semibold text-zinc-900 text-2xl leading-tight m-0">User Management</h1>
                    <p className="text-slate-500 text-xs">Manage system users and access</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => loadData()}
                        className="bg-[#3c8e75] hover:bg-[#317561] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </button>
                    {hasPermission(currentUser, PERMISSIONS.USERS.MANAGE) && (
                        <button
                            className="bg-[#f26522] hover:bg-[#d45316] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white"
                        >
                            <UserPlus className="h-4 w-4" />
                            Add User
                        </button>
                    )}
                </div>
            </div>

            <Card className="flex-1 flex flex-col rounded-xl border border-slate-200 shadow-sm p-4">
                <CardContent className="flex-1 flex flex-col px-0 pb-2">
                    <div className="mb-4 py-2.5 px-4 bg-[#eaf6f1] border border-[#d3ebd6] rounded w-full flex flex-col sm:flex-row gap-3 items-end shrink-0">
                        <div className="flex-1 min-w-[200px] flex flex-col gap-1.5 w-full">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search users</label>
                            <div className="flex h-8">
                                <span className="flex items-center px-3 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                    <Search className="h-3 w-3" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="flex-1 border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-start sm:justify-end h-8 shrink-0 w-full sm:w-auto">
                            <button
                                onClick={handleSearch}
                                className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-6 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer"
                            >
                                Search
                            </button>
                            <button
                                onClick={handleReset}
                                className="h-8 px-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                                title="Reset filters"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </button>
                            <button
                                onClick={handleExport}
                                className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-4 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto border border-slate-200 shadow-xs rounded mb-4">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    <th className="bg-[#f26522] text-white py-2 px-3 text-left font-semibold">Name</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Email</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Role</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Status</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Last Login</th>
                                    <th className="bg-[#001b33] text-white py-2 px-3 text-left font-semibold">Created Date</th>
                                    <th className="bg-[#001b33] text-white py-2 px-3 text-left font-semibold">Actions</th>
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
                                        <tr key={user.id} className="border-b border-slate-200 last:border-0 odd:bg-white even:bg-[#fff9f5] hover:bg-slate-50 transition-colors">
                                            <td className="py-2 px-3 font-bold text-slate-900 align-middle">{user.name}</td>
                                            <td className="py-2 px-3 text-slate-700 align-middle">{user.email}</td>
                                            <td className="py-2 px-3 align-middle">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f0ff] text-[#0066cc]">
                                                    <span className="text-[#3b82f6] font-bold mr-0.5">•</span> {user.role}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 align-middle">
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
                                            <td className="py-2 px-3 text-slate-700 align-middle">{user.lastLogin || 'Never'}</td>
                                            <td className="py-2 px-3 text-slate-700 align-middle">{formatDate(user.createdAt)}</td>
                                            <td className="py-2 px-3 align-middle">
                                                <div className="flex gap-2 justify-start items-center">
                                                    <button
                                                        title="View Details"
                                                        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    {hasPermission(currentUser, PERMISSIONS.USERS.MANAGE) && (
                                                        <>
                                                            <button
                                                                title="Edit User"
                                                                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                title={user.status === 'Active' ? 'Deactivate User' : 'Reactivate User'}
                                                                onClick={() => handleToggleStatus(user.id, user.status)}
                                                                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                                            >
                                                                {user.status === 'Active' ? (
                                                                    <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                                                                ) : (
                                                                    <RefreshCw className="h-4 w-4 text-slate-400 hover:text-green-600" />
                                                                )}
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
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
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
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageContainer>
    );
}