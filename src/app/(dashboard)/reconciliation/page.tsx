// src/app/(dashboard)/reconciliation/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar, Download, AlertTriangle, RefreshCw, RotateCcw, ChevronDown, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { reconciliationService } from '@/services/reconciliationService';
import { authService } from '@/lib/auth';
import { formatFuel, formatNumber, exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils';
import { Reconciliation } from '@/types/reconciliation';
import { useClientStore, CLIENTS } from '@/services/api';
import { CustomTable } from '@/components/ui/table';
import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

export default function ReconciliationPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [records, setRecords] = useState<Reconciliation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
                setExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
    ];
    const [pageSize] = useState(30);
    const [totalPages, setTotalPages] = useState(1);

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
    }, [router, page, selectedClient, dateRange.startDate, dateRange.endDate, dateRange.preset, selectedStatus]);

    const loadData = async (overrideDateRange?: DateRange) => {
        try {
            setLoading(true);
            setRecords([]);
            const currentRange = overrideDateRange || dateRange;
            const response = await reconciliationService.getReconciliationRecords({
                page,
                pageSize,
                status: selectedStatus || undefined,
                startDate: currentRange.startDate || undefined,
                endDate: currentRange.endDate || undefined,
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

    const summaryData = (() => {
        if (records.length === 0) return null;
        const totalDeliveries = records.reduce((sum, r) => sum + r.deliveries, 0);
        const totalIssues = records.reduce((sum, r) => sum + r.fuelIssues, 0);
        const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const openingDip = sorted[0]?.openingBalance || 0;
        const closingDip = sorted[sorted.length - 1]?.actualClosing || 0;
        const closingStock = openingDip + totalDeliveries - totalIssues;
        const variance = closingDip - closingStock;
        const variancePercent = closingStock > 0 ? (variance / closingStock) * 100 : 0;
        const avDailyCons = records.length > 0 ? totalIssues / records.length : 0;
        const daysStock = avDailyCons > 0 ? Math.round(closingDip / avDailyCons) : 0;
        const today = new Date();
        const reorderDays = 7;
        const matchedClient = CLIENTS.find(c => c.clientid === selectedClient?.clientid || c.name === selectedClient?.name);
        const minStock = matchedClient?.minStock ?? selectedClient?.minStock ?? Math.round(avDailyCons * reorderDays);
        const reorderDate = new Date(today);
        reorderDate.setDate(today.getDate() + Math.max(0, daysStock - reorderDays));
        const arrivalDate = new Date(reorderDate);
        arrivalDate.setDate(reorderDate.getDate() + 1);
        const formatDateStr = (date: Date) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear().toString().slice(-2)}`;
        };
        return { openingDip, totalIssues, totalDeliveries, closingDip, closingStock, variance, variancePercent, avDailyCons, daysStock, minStock, reorderDays, reorderDate: formatDateStr(reorderDate), arrivalDate: formatDateStr(arrivalDate) };
    })();

    const filteredRecords = records.filter(record => selectedStatus ? record.status === selectedStatus : true);

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        if (records.length === 0) {
            setExportOpen(false);
            return;
        }
        setIsExporting(format);
        try {
            const dateLabel = dateRange.preset || 'custom';
            const headers = ['Date', 'Opening Balance (L)', 'Deliveries (+L)', 'Fuel Issues (-L)', 'Expected Closing (L)', 'Actual Closing (L)', 'Variance (L)', 'Variance %'];
            const rows = records.map(record => {
                const vPercent = record.expectedClosing > 0 ? (record.variance / record.expectedClosing) * 100 : 0;
                return [
                    record.date,
                    record.openingBalance,
                    `+${record.deliveries}`,
                    `-${record.fuelIssues}`,
                    record.expectedClosing,
                    record.actualClosing,
                    `${record.variance >= 0 ? '+' : ''}${record.variance}`,
                    `${vPercent >= 0 ? '+' : ''}${vPercent.toFixed(1)}%`
                ];
            });
            if (summaryData) {
                rows.push([
                    'TOTALS / NET',
                    '',
                    `+${summaryData.totalDeliveries}`,
                    `-${summaryData.totalIssues}`,
                    '',
                    '',
                    `${summaryData.variance >= 0 ? '+' : ''}${summaryData.variance.toFixed(2)}`,
                    `${summaryData.variancePercent.toFixed(1)}%`
                ]);
            }

            if (format === 'csv') {
                exportToCSV(`reconciliation_${dateLabel}.csv`, headers, rows);
            } else if (format === 'excel') {
                exportToExcel(`reconciliation_${dateLabel}.xlsx`, headers, rows, 'Reconciliation');
            } else if (format === 'pdf') {
                exportToPDF('Reconciliation Report', headers, rows);
            }
        } catch (err) {
            console.error('Failed to export reconciliation report:', err);
        } finally {
            setIsExporting(null);
            setExportOpen(false);
        }
    };

    const handleReset = () => {
        const defaultRange = getDateRangeFromPreset('30days');
        setSelectedStatus('');
        setDateRange(defaultRange);
        setPage(1);
        loadData(defaultRange);
    };

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
                    <Button onClick={() => loadData()}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            {/* Filter bar container matching standard dashboard structure */}
            <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-visible">
                <div className="flex flex-wrap items-end gap-3.5 overflow-visible">
                    <div className="w-[150px] shrink-0">
                        <DateRangePicker
                            value={dateRange}
                            onChange={(newRange) => {
                                setDateRange(newRange);
                                setPage(1);
                            }}
                            allRecords={records as any}
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            onClick={handleReset}
                            className="bg-white hover:bg-slate-50 text-xs font-semibold border border-slate-200 rounded px-3.5 h-8 shadow-xs text-slate-600 flex items-center justify-center gap-1.5 transition-colors duration-200 shrink-0"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset
                        </Button>
                        {/* Export with 3 options: Excel, CSV, PDF */}
                        <div className="relative" ref={exportRef}>
                            <Button
                                type="button"
                                onClick={() => setExportOpen((prev) => !prev)}
                                className="bg-[#f26522] hover:bg-[#d45316] text-white text-xs font-semibold rounded h-8 px-3.5 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                                title="Export Options"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span>Export</span>
                                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${exportOpen ? 'rotate-180' : ''}`} />
                            </Button>

                            {exportOpen && (
                                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                                        Export Format
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleExport('excel')}
                                        disabled={!!isExporting}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="p-1.5 rounded bg-emerald-100 text-emerald-700">
                                            <FileSpreadsheet className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-800">Excel</div>
                                            <div className="text-[10px] text-slate-400">Spreadsheet (.xlsx)</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExport('csv')}
                                        disabled={!!isExporting}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="p-1.5 rounded bg-sky-100 text-sky-700">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-800">CSV</div>
                                            <div className="text-[10px] text-slate-400">Comma-separated (.csv)</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExport('pdf')}
                                        disabled={!!isExporting}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <div className="p-1.5 rounded bg-rose-100 text-rose-700">
                                            <FileDown className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-800">PDF</div>
                                            <div className="text-[10px] text-slate-400">Printable Document (.pdf)</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
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
