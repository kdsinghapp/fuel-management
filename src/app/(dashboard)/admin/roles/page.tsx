// src/app/admin/roles/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Shield, Users, Eye, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { authService, hasPermission, PERMISSIONS } from '@/lib/auth';

const roleData = [
    {
        role: 'Administrator',
        subtitle: 'Full Access Control',
        description: 'Full system access with complete authority over all modules and user administration.',
        icon: Shield,
        iconBg: 'bg-[#ff6d00]/10 text-[#ff6d00]',
        iconColor: '#ff6d00',
        permissions: {
            dashboard: true,
            fuelLevels: true,
            deliveries: true,
            fuelIssues: true,
            vehicles: true,
            reconciliation: true,
            reports: true,
            users: true,
            roles: true,
        },
    },
    {
        role: 'Manager',
        subtitle: 'Operational Control',
        description: 'Operational access to view and manage fuel data without user administration control.',
        icon: Users,
        iconBg: 'bg-[#1b5e20]/10 text-[#1b5e20]',
        iconColor: '#1b5e20',
        permissions: {
            dashboard: true,
            fuelLevels: true,
            deliveries: true,
            fuelIssues: true,
            vehicles: true,
            reconciliation: true,
            reports: true,
            users: false,
            roles: false,
        },
    },
    {
        role: 'Viewer',
        subtitle: 'Read-Only Access',
        description: 'Read-only access operational modules for monitoring and reporting purposes.',
        icon: Eye,
        iconBg: 'bg-[#37474f]/10 text-[#37474f]',
        iconColor: '#37474f',
        permissions: {
            dashboard: true,
            fuelLevels: true,
            deliveries: true,
            fuelIssues: true,
            vehicles: true,
            reconciliation: true,
            reports: true,
            users: false,
            roles: false,
        },
    },
];

const permissionLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    fuelLevels: 'Fuel Levels',
    deliveries: 'Deliveries',
    fuelIssues: 'Fuel Issues',
    vehicles: 'Vehicles',
    reconciliation: 'Reconciliation',
    reports: 'Reports',
    users: 'Users',
    roles: 'Roles',
};

export default function RolesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
            const user = await authService.getCurrentUser();
            if (!hasPermission(user, PERMISSIONS.ROLES.VIEW)) {
                router.push('/dashboard');
                return;
            }
            setLoading(false);
        };
        checkAuth();
    }, [router]);

    if (loading) {
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
                    <Button onClick={() => setError(null)}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <div className="space-y-6 flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="font-bold text-zinc-950 text-2xl leading-tight m-0">Roles & Permissions</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">Manage role-based access control</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-[#3c8e75] hover:bg-[#317561] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </button>
                </div>

                {/* Role Cards */}
                <div className="grid gap-6 md:grid-cols-3 shrink-0">
                    {roleData.map((role) => {
                        const Icon = role.icon;
                        const allowedCount = Object.values(role.permissions).filter(Boolean).length;
                        const totalCount = Object.keys(role.permissions).length;

                        return (
                            <Card key={role.role} className="border border-zinc-100 shadow-sm rounded-xl overflow-hidden bg-white">
                                <CardContent className="p-6">
                                    {/* Card Header Section */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl ${role.iconBg} flex items-center justify-center`}>
                                                <Icon className="h-6 w-6" style={{ color: role.iconColor }} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-zinc-900 text-lg leading-tight">{role.role}</h3>
                                                <p className="text-xs text-zinc-400 mt-0.5 font-medium">{role.subtitle}</p>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e6f4ea] text-[#137333] border border-[#ceead6]">
                                            <span className="h-1.5 w-1.5 rounded-full bg-[#137333]" />
                                            Active
                                        </span>
                                    </div>

                                    {/* Description */}
                                    <p className="text-xs text-zinc-500 leading-relaxed mb-5 min-h-[32px]">
                                        {role.description}
                                    </p>

                                    {/* Permissions Header */}
                                    <div className="flex items-center justify-between border border-zinc-200 rounded-lg px-3 py-2 bg-white mb-4">
                                        <span className="text-xs font-semibold text-zinc-700">Permissions Allowed</span>
                                        <span className="bg-zinc-950 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                                            {allowedCount}/{totalCount}
                                        </span>
                                    </div>

                                    {/* Badges */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(role.permissions).map(([key, value]) => {
                                            const label = permissionLabels[key];
                                            return (
                                                <span
                                                    key={key}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                                        value
                                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                                            : 'bg-red-50 text-red-800 border-red-100'
                                                    }`}
                                                >
                                                    {value ? (
                                                        <Check className="h-3 w-3 stroke-[2.5]" />
                                                    ) : (
                                                        <X className="h-3 w-3 stroke-[2.5]" />
                                                    )}
                                                    {label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Matrix Table */}
                <Card className="flex-1 flex flex-col border border-zinc-200 shadow-sm overflow-hidden rounded-xl bg-white">
                    <CardHeader className="py-4 px-6 border-b border-zinc-100 bg-white shrink-0">
                        <CardTitle className="text-base font-bold text-zinc-800">Permission Matrix</CardTitle>
                        <CardDescription className="text-zinc-500 text-xs">Detailed view of all role permissions</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0">
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200">
                                        <th className="bg-[#e65100] text-white py-3.5 px-6 text-left font-bold w-[250px]">Resource</th>
                                        <th className="bg-[#1b5e20] text-white py-3.5 px-6 text-left font-bold">Administrator</th>
                                        <th className="bg-[#2e7d32] text-white py-3.5 px-6 text-left font-bold">Manager</th>
                                        <th className="bg-[#212121] text-white py-3.5 px-6 text-left font-bold">Viewer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(permissionLabels).map(([key, label], index) => (
                                        <tr
                                            key={key}
                                            className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors ${
                                                index % 2 === 0 ? 'bg-[#fffbf7]' : 'bg-white'
                                            }`}
                                        >
                                            <td className="py-3 px-6 font-semibold text-zinc-800">{label}</td>
                                            {roleData.map((role) => {
                                                const hasPerm = role.permissions[key as keyof typeof role.permissions];
                                                return (
                                                    <td key={role.role} className="py-3 px-6 align-middle">
                                                        {hasPerm ? (
                                                            <div className="h-3 w-3 rounded-full bg-[#1b5e20]" />
                                                        ) : null}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
}