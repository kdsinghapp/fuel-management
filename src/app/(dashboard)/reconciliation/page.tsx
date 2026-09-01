// src/app/(dashboard)/reconciliation/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar, Download, AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { reconciliationService } from '@/services/reconciliationService';
import { authService } from '@/lib/auth';
import { formatFuel, formatNumber } from '@/lib/utils';
import { Reconciliation } from '@/types/reconciliation';
import { useClientStore } from '@/services/api';
import { CustomTable } from '@/components/ui/table';

export default function ReconciliationPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [records, setRecords] = useState<Reconciliation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const columns = [
        {
            key: "date",
            header: "Date",
            headerClassName: "bg-[#001b33] text-white",
            cellClassName: "py-2 px-3 font-semibold text-slate-855 align-middle",
        },
        {
            key: "openingBalance",
            header: "Opening Balance",
            headerClassName: "bg-[#001b33] text-white",
            cellClassName: "py-2 px-3 text-slate-600 align-middle",
            render: (record: Reconciliation) => formatFuel(record.openingBalance),
        },
        {
            key: "deliveries",
            header: "Deliveries",
            headerClassName: "bg-[#137e19] text-white",
            cellClassName: "py-2 px-3 text-green-600 align-middle",
            render: (record: Reconciliation) => `+${formatFuel(record.deliveries)}`,
        },
        {
            key: "fuelIssues",
            header: "Fuel Issues",
            headerClassName: "bg-[#f26522] text-white",
            cellClassName: "py-2 px-3 text-red-600 align-middle",
            render: (record: Reconciliation) => `-${formatFuel(record.fuelIssues)}`,
        },
        {
            key: "expectedClosing",
            header: "Expected Closing",
            headerClassName: "bg-[#001b33] text-white",
            cellClassName: "py-2 px-3 text-slate-600 align-middle",
            render: (record: Reconciliation) => formatFuel(record.expectedClosing),
        },
        {
            key: "actualClosing",
            header: "Actual Closing",
            headerClassName: "bg-[#001b33] text-white",
            cellClassName: "py-2 px-3 text-slate-600 align-middle",
            render: (record: Reconciliation) => formatFuel(record.actualClosing),
        },
        {
            key: "variance",
            header: "Variance",
            headerClassName: "bg-[#137e19] text-white",
            cellClassName: (record: Reconciliation) => `py-2 px-3 font-bold align-middle ${record.variance >= 0 ? 'text-green-600' : 'text-red-650'}`,
            render: (record: Reconciliation) => `${record.variance >= 0 ? '+' : ''}${formatFuel(record.variance)}`,
        },
        {
            key: "variancePercent",
            header: "Variance %",
            headerClassName: "bg-[#137e19] text-white",
            cellClassName: (record: Reconciliation) => {
                const vPercent = record.expectedClosing > 0 ? (record.variance / record.expectedClosing) * 100 : 0;
                return `py-2 px-3 font-bold align-middle ${vPercent >= 0 ? 'text-green-600' : 'text-red-650'}`;
            },
            render: (record: Reconciliation) => {
                const vPercent = record.expectedClosing > 0 ? (record.variance / record.expectedClosing) * 100 : 0;
                return `${vPercent >= 0 ? '+' : ''}${vPercent.toFixed(1)}%`;
            },
        },
        {
            key: "status",
            header: "Status",
            headerClassName: "bg-[#555555] text-white",
            cellClassName: "py-2 px-3 align-middle",
            render: (record: Reconciliation) => <StatusBadge status={record.status} />,
        },
    ];
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);

    // Date range filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const checkAuth = async () => {
            const isAuthenticated = await authService.isAuthenticated();
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
            loadData();
        };
        checkAuth();
    }, [router, page, selectedClient, startDate, endDate]);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await reconciliationService.getReconciliationRecords({
                page,
                pageSize,
                status: selectedStatus || undefined,
                startDate,
                endDate,
            });
            setRecords(response.data);
            setTotal(response.total);
            setTotalPages(response.totalPages);
            setError(null);
        } catch (err) {
            setError('Failed to load reconciliation records');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    // Calculate dynamic values for top summary tables
    const summaryData = (() => {
        if (records.length === 0) return null;

        // Cumulative sum for the selected range
        const totalDeliveries = records.reduce((sum, r) => sum + r.deliveries, 0);
        const totalIssues = records.reduce((sum, r) => sum + r.fuelIssues, 0);

        // Sorting chronologically to get opening/closing
        const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const openingDip = sorted[0]?.openingBalance || 0;
        const closingDip = sorted[sorted.length - 1]?.actualClosing || 0;
        const closingStock = openingDip + totalDeliveries - totalIssues; // Expected
        const variance = closingDip - closingStock;
        const variancePercent = closingStock > 0 ? (variance / closingStock) * 100 : 0;

        // Stock Demand Plan Calculations
        const avDailyCons = records.length > 0 ? totalIssues / records.length : 0;
        const daysStock = avDailyCons > 0 ? Math.round(closingDip / avDailyCons) : 0;

        // Order Date calculations
        const today = new Date();
        const reorderDays = 7;
        const minStock = 3000;

        const reorderDate = new Date(today);
        reorderDate.setDate(today.getDate() + Math.max(0, daysStock - reorderDays));

        const arrivalDate = new Date(today);
        arrivalDate.setDate(today.getDate() + daysStock);

        const formatDateStr = (date: Date) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear().toString().slice(-2)}`;
        };

        return {
            openingDip,
            totalIssues,
            totalDeliveries,
            closingDip,
            closingStock,
            variance,
            variancePercent,
            avDailyCons,
            daysStock,
            minStock,
            reorderDays,
            reorderDate: formatDateStr(reorderDate),
            arrivalDate: formatDateStr(arrivalDate)
        };
    })();

    const filteredRecords = records.filter(record =>
        selectedStatus ? record.status === selectedStatus : true
    );

    const handleExport = () => {
        if (records.length === 0) return;

        const headers = ['Date', 'Opening Balance', 'Deliveries', 'Fuel Issues', 'Expected Closing', 'Actual Closing', 'Variance', 'Variance %', 'Status'];
        const rows = records.map(record => {
            const vPercent = record.expectedClosing > 0 ? (record.variance / record.expectedClosing) * 100 : 0;
            return [
                record.date,
                record.openingBalance,
                record.deliveries,
                record.fuelIssues,
                record.expectedClosing,
                record.actualClosing,
                record.variance,
                `${vPercent.toFixed(1)}%`,
                record.status
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => typeof val === 'string' ? `"${val}"` : val).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reconciliation_export_${startDate}_to_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleReset = () => {
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    if (loading && records.length === 0) {
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
                    <Button onClick={loadData}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                <div>
                    <h2 className="font-semibold text-zinc-900 text-2xl leading-tight m-0">Reconciliation</h2>
                    <span className="text-sm text-zinc-500 mt-1 inline-block">Daily fuel reconciliation and variance tracking</span>
                </div>

                <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Date From</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-white border border-zinc-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 h-10 text-zinc-700 w-full sm:w-40"
                        />
                    </div>
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Date To</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-white border border-zinc-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 h-10 text-zinc-700 w-full sm:w-40"
                        />
                    </div>
                    <Button
                        onClick={loadData}
                        className="bg-[#3c8e75] hover:bg-[#317561] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white w-full sm:w-auto justify-center"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                    <Button
                        onClick={handleReset}
                        className="bg-white hover:bg-zinc-50 text-sm font-semibold border border-zinc-200 rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 h-10 shadow-sm text-zinc-600 w-full sm:w-auto justify-center"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </Button>
                    <Button
                        onClick={handleExport}
                        className="bg-[#f26522] hover:bg-[#d45316] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white w-full sm:w-auto justify-center"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Dynamic Summary Cards */}
            {summaryData && (
                <div className="grid gap-6 md:grid-cols-12 items-start">
                    {/* Stock Reconciliation Summary (Span 4) */}
                    <div className="md:col-span-4 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <div className="bg-primary py-2 px-3 text-center border-b border-white/20">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Stock Reconciliation Summary</span>
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <tbody>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Opening Dip</td>
                                    <td className="p-2 text-right text-slate-900">{formatNumber(summaryData.openingDip)}</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Fuel Issues</td>
                                    <td className="p-2 text-right text-slate-900">{formatNumber(summaryData.totalIssues)}</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Fuel Receipts</td>
                                    <td className="p-2 text-right text-slate-900">{formatNumber(summaryData.totalDeliveries)}</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Closing Dip</td>
                                    <td className="p-2 text-right text-slate-900">{formatNumber(summaryData.closingDip)}</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Closing Stock</td>
                                    <td className="p-2 text-right text-slate-900">{formatNumber(summaryData.closingStock)}</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Variance</td>
                                    <td className="p-2 text-right text-slate-900 font-bold">{formatNumber(Number(summaryData.variance.toFixed(2)))}</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="p-2 font-bold text-slate-900">%</td>
                                    <td className="p-2 text-right text-slate-900 font-bold">{summaryData.variancePercent.toFixed(1)}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Stock Demand Plan (Span 8) */}
                    <div className="md:col-span-8 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <div className="bg-[#137e19] py-2 px-3 text-center border-b border-white/20">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Stock Demand Plan</span>
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <tbody>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900 w-1/4">Stock</td>
                                    <td className="p-2 text-center text-slate-900 w-1/5">{formatNumber(summaryData.closingDip)}</td>
                                    <td className="p-2 text-slate-700">Balance remaining in the Tank.</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Av Daily Cons.</td>
                                    <td className="p-2 text-center text-slate-900">{formatNumber(Math.round(summaryData.avDailyCons))}</td>
                                    <td className="p-2 text-slate-700">Average Fuel Consumption/Day MTD.</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Days Stock</td>
                                    <td className="p-2 text-center text-slate-900">{summaryData.daysStock}</td>
                                    <td className="p-2 text-slate-700">Days left before Stock run Out based on Rated Use.</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Min Stock</td>
                                    <td className="p-2 text-center text-slate-900">{formatNumber(summaryData.minStock)}</td>
                                    <td className="p-2 text-slate-700">Critical Tank Level for Main Tank.</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Re-Order</td>
                                    <td className="p-2 text-center text-slate-900">{summaryData.reorderDays}</td>
                                    <td className="p-2 text-slate-700">Days to prepare for New Purchase.</td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-white">
                                    <td className="p-2 font-bold text-slate-900">Re-Order</td>
                                    <td className="p-2 text-center text-slate-900 font-semibold text-amber-600">{summaryData.reorderDate}</td>
                                    <td className="p-2 text-slate-700">Placing Of order Date</td>
                                </tr>
                                <tr className="bg-white">
                                    <td className="p-2 font-bold text-slate-900">Stock Arrival</td>
                                    <td className="p-2 text-center text-slate-900 font-semibold text-emerald-600">{summaryData.arrivalDate}</td>
                                    <td className="p-2 text-slate-700">Delivery of stock Date</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Historical Records */}
            <Card className="flex-1 flex flex-col rounded-xl border border-slate-200 shadow-sm p-4 mt-4">
                <CardContent className="flex-1 flex flex-col p-0">
                    <CustomTable
                        data={filteredRecords}
                        columns={columns}
                        keyExtractor={(record) => record.id}
                        emptyStateText="No reconciliation records found"
                        className="flex-1 border border-slate-200 rounded-none shadow-none mb-0"
                        rowClassName="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors"
                        headerRowClassName="divide-x-0"
                    />

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-auto pt-4 px-6 shrink-0">
                            <p className="text-sm text-muted-foreground">
                                Showing {filteredRecords.length} of {total} records
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
                                <span className="flex items-center px-3 text-sm">
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
