// src/app/(dashboard)/deliveries/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Calendar, Download, AlertTriangle, RefreshCw, RotateCcw, Sliders } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { deliveryService } from '@/services/deliveryService';
import { authService } from '@/lib/auth';
import { formatDate, formatFuel, exportToCSV } from '@/lib/utils';
import { FuelDelivery } from '@/types/fuel';
import { useClientStore } from '@/services/api';

import { CustomTable } from '@/components/ui/table';

import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

export default function DeliveriesPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [allDeliveries, setAllDeliveries] = useState<FuelDelivery[]>([]);
    const [deliveries, setDeliveries] = useState<FuelDelivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));

    const columns = [
        {
            key: "deliveryId",
            header: "Delivery ID",
            headerClassName: "bg-primary text-white",
            cellClassName: "font-bold text-slate-900",
        },
        {
            key: "date",
            header: "Date",
            headerClassName: "bg-[#137e19] text-white",
            cellClassName: "text-slate-600",
        },
        {
            key: "time",
            header: "Time",
            headerClassName: "bg-[#137e19] text-white",
            cellClassName: "text-slate-600",
        },
        {
            key: "quantity",
            header: "Quantity",
            headerClassName: "bg-[#222] text-white",
            cellClassName: "font-bold text-slate-900",
            render: (delivery: FuelDelivery) => formatFuel(delivery.quantity),
        },
        {
            key: "name",
            header: "Name",
            headerClassName: "bg-primary text-white",
            cellClassName: "text-slate-600",
            render: (delivery: FuelDelivery) => delivery.name || 'Calculated Delivery',
        },
        {
            key: "acronym",
            header: "Acronym",
            headerClassName: "bg-primary text-white",
            cellClassName: "text-slate-600",
            render: (delivery: FuelDelivery) => delivery.acronym || 'CD',
        },
    ];

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
    }, [router, page, selectedClient, dateRange.startDate, dateRange.endDate, dateRange.preset]);

    const loadData = async (
        overrideSearch?: string,
        overrideDateRange?: DateRange
    ) => {
        try {
            setLoading(true);
            const currentRange = overrideDateRange || dateRange;
            const currentSearch = overrideSearch !== undefined ? overrideSearch : search;

            const response = await deliveryService.getDeliveries({
                page,
                pageSize,
                search: currentSearch || undefined,
                startDate: currentRange.startDate || undefined,
                endDate: currentRange.endDate || undefined,
            });
            setDeliveries(response.data);
            setTotal(response.total);
            setTotalPages(response.totalPages);

            // Fetch all records for badge counts in DateRangePicker if needed
            if (allDeliveries.length === 0 || currentRange.preset === 'all') {
                const allResponse = await deliveryService.getDeliveries({
                    page: 1,
                    pageSize: 100000,
                    startDate: undefined,
                    endDate: undefined
                });
                setAllDeliveries(allResponse.data);
            }

            setError(null);
        } catch (err) {
            setError('Failed to load deliveries');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        loadData();
    };

    const handleReset = () => {
        const defaultRange = getDateRangeFromPreset('30days');
        setSearch('');
        setDateRange(defaultRange);
        setPage(1);
        loadData('', defaultRange);
    };

    const handleExport = async () => {
        try {
            const response = await deliveryService.getDeliveries({
                page: 1,
                pageSize: 100000,
                search: search || undefined,
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
            });
            const exportDeliveries = response.data;
            if (exportDeliveries.length === 0) return;
            const headers = ['Delivery ID', 'Date', 'Time', 'Quantity (L)', 'Name', 'Acronym'];
            const rows = exportDeliveries.map(d => [
                d.deliveryId,
                d.date,
                d.time,
                d.quantity,
                d.name || 'Calculated Delivery',
                d.acronym || 'CD',
            ]);
            exportToCSV(`deliveries_${dateRange.preset}.csv`, headers, rows);
        } catch (err) {
            console.error('Failed to export deliveries:', err);
        }
    };

    if (loading && deliveries.length === 0) {
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
            {/* Filters & Table Card wrapper */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 shadow-sm rounded p-4 mb-4">
                {/* Filter bar container matching the bootstrap grid structure */}
                <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                        <div className="flex flex-col sm:flex-row flex-1 gap-3 items-stretch sm:items-end">
                            {/* Search Input Group */}
                            <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search Deliveries</label>
                                <div className="flex h-8">
                                    <span className="flex items-center px-3 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                        <Search className="h-3 w-3" />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Search by ID..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        className="flex-1 border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                    />
                                </div>
                            </div>

                            {/* Date Range Selector */}
                            <DateRangePicker
                                value={dateRange}
                                onChange={(newRange) => {
                                    setDateRange(newRange);
                                    setPage(1);
                                }}
                                allRecords={allDeliveries as any}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-start md:justify-end h-8 shrink-0">
                            <Button
                                onClick={handleSearch}
                                className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-4 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                            >
                                <Sliders className="h-3.5 w-3.5" />
                                Search
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleReset}
                                className="h-8 px-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
                                title="Reset filters"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </Button>
                            <Button
                                onClick={handleExport}
                                className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-4 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                title="Export fuel levels"
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export
                            </Button>
                        </div>
                    </div>
                </div>

                <CustomTable
                    data={deliveries}
                    columns={columns}
                    keyExtractor={(d) => d.id}
                    emptyStateText="No deliveries found"
                    className="flex-1"
                />

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-auto pt-4 px-6 shrink-0">
                        <p className="text-sm text-muted-foreground">
                            Showing {deliveries.length} of {total} deliveries
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
            </div>
        </PageContainer>
    );
}
