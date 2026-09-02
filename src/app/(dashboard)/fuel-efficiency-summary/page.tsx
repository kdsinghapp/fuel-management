// src/app/(dashboard)/fuel-efficiency-summary/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, AlertTriangle, RefreshCw, RotateCcw, Sliders } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { fuelIssueService } from '@/services/fuelIssueService';
import { authService } from '@/lib/auth';
import { formatNumber, exportToCSV } from '@/lib/utils';
import { useClientStore } from '@/services/api';
import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

interface VehicleEfficiency {
    id: string;
    description: string;
    ltrs: number;
    date: string;
    time: string;
    distance: number;
    kmPerLtr: number;
    ltrsPer100Km: number;
}

export default function FuelEfficiencySummaryPage() {
    const router = useRouter();
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [data, setData] = useState<VehicleEfficiency[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedEfficiency, setSelectedEfficiency] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));

    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);

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
    }, [router, selectedClient, dateRange.startDate, dateRange.endDate, dateRange.preset]);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await fuelIssueService.getFuelIssues({
                page: 1,
                pageSize: 100000,
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
            });

            if (!response.data || response.data.length === 0) {
                setData([]);
                setError(null);
                return;
            }

            // Map each individual transaction without combining
            const computed: VehicleEfficiency[] = response.data.map((tx: any, idx: number) => {
                const vehicle = (tx.vehicleId && tx.vehicleId.trim() !== '' ? tx.vehicleId : (tx.driverAttendant || 'Unknown')).toUpperCase();
                const qty = Number(tx.fuelQuantity) || 0;
                const odo = Number(tx.odometer) || 0;
                const txDate = tx.date || tx.Date || tx.lastDate || (tx.createdAt ? tx.createdAt.split('T')[0] : '');
                const txTime = tx.time || tx.Time || (tx.createdAt ? tx.createdAt.split('T')[1]?.replace('Z', '') : '');

                const kmPerLtr = odo > 0 && qty > 0 ? Number((odo / qty).toFixed(2)) : 0;
                const ltrsPer100Km = odo > 0 && qty > 0 ? Number(((qty / odo) * 100).toFixed(1)) : 0;

                return {
                    id: `${tx.transactionId || idx}`,
                    description: vehicle,
                    ltrs: Number(qty.toFixed(2)),
                    date: txDate,
                    time: txTime,
                    distance: odo,
                    kmPerLtr,
                    ltrsPer100Km,
                };
            });

            // Sort by latest date/time descending
            computed.sort((a, b) => {
                const timeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime() || 0;
                const timeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime() || 0;
                return timeB - timeA;
            });

            setData(computed);

            if (allRecords.length === 0 || dateRange.preset === 'all') {
                setAllRecords(response.data);
            }
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to compute fuel efficiency metrics from live data.');
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const handleReset = () => {
        const defaultRange = getDateRangeFromPreset('30days');
        setSearchInput('');
        setSearch('');
        setSelectedEfficiency('');
        setDateRange(defaultRange);
        setPage(1);
    };

    const filteredData = data.filter(item => {
        const query = search.toLowerCase();
        const matchesSearch = item.description.toLowerCase().includes(query) ||
            item.date.toLowerCase().includes(query);
        
        if (selectedEfficiency === 'Normal') {
            return matchesSearch && item.ltrsPer100Km > 0 && item.ltrsPer100Km <= 15;
        }
        if (selectedEfficiency === 'Poor') {
            return matchesSearch && item.ltrsPer100Km > 15;
        }
        return matchesSearch;
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

    const handleExport = () => {
        if (filteredData.length === 0) return;
        const headers = ['Vehicle Description', 'Ltrs', 'Date', 'Time', 'Distance (KM)', 'KM per Ltr', 'Ltrs per 100KM'];
        const rows = filteredData.map(item => [
            item.description,
            item.ltrs,
            item.date,
            item.time,
            item.distance > 0 ? item.distance : '—',
            item.kmPerLtr > 0 ? item.kmPerLtr : '—',
            item.ltrsPer100Km > 0 ? item.ltrsPer100Km : '—'
        ]);
        exportToCSV('fuel_efficiency_summary.csv', headers, rows);
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
                    <Button onClick={loadData}>Try Again</Button>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="font-semibold text-zinc-900 text-2xl leading-tight m-0">Fuel Efficiency Summary</h2>
                    <span className="text-sm text-zinc-500 mt-1 inline-block">Detailed view of vehicle fuel burn rates and usage (Calculated from Live API)</span>
                </div>
                <Button
                    onClick={loadData}
                    className="bg-[#3c8e75] hover:bg-[#317561] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white"
                >
                    <RefreshCw className="h-4 w-4 mr-0.5" />
                    Refresh
                </Button>
            </div>

            <Card className="rounded border border-slate-200 shadow-sm p-4 mb-4 overflow-visible">
                <CardContent className="p-0 overflow-visible">
                    {/* Filter bar container matching single horizontal row structure */}
                    <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-visible">
                        <div className="flex items-end justify-between gap-2.5">
                            {/* Left Filters Group - All in 1 line */}
                            <div className="flex items-end gap-2 shrink-0">
                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1 w-[180px] sm:w-[210px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Search vehicles</label>
                                    <div className="flex h-8">
                                        <span className="flex items-center px-2.5 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                            <Search className="h-3 w-3" />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search by vehicle..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            className="w-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                        />
                                    </div>
                                </div>

                                {/* Efficiency Result Selector */}
                                <div className="flex flex-col gap-1 w-[190px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Efficiency Result</label>
                                    <select
                                        value={selectedEfficiency}
                                        onChange={(e) => {
                                            setSelectedEfficiency(e.target.value);
                                            setPage(1);
                                        }}
                                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 cursor-pointer w-full"
                                    >
                                        <option value="">All results</option>
                                        <option value="Normal">Normal Efficiency (&le; 15 L/100Km)</option>
                                        <option value="Poor">Poor Efficiency (&gt; 15 L/100Km)</option>
                                    </select>
                                </div>

                                {/* Date Range Selector */}
                                <div className="w-[130px] shrink-0">
                                    <DateRangePicker
                                        value={dateRange}
                                        onChange={(newRange) => {
                                            setDateRange(newRange);
                                            setPage(1);
                                        }}
                                        allRecords={allRecords as any}
                                    />
                                </div>
                            </div>

                            {/* Right Action Buttons Group */}
                            <div className="flex items-end gap-1.5 shrink-0">
                                {/* Search Button */}
                                <Button
                                    onClick={handleSearch}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-3.5 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                >
                                    <Sliders className="h-3.5 w-3.5" />
                                    Search
                                </Button>

                                {/* Reset Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-8 px-3.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
                                    title="Reset filters"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reset
                                </Button>

                                {/* Export Button */}
                                <Button
                                    onClick={handleExport}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-3.5 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                    title="Export"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Export
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 shadow-xs rounded mb-4">
                        <table className="w-full text-sm border-collapse whitespace-nowrap">
                            <thead>
                                <tr>
                                    <th className="bg-[#f26522] text-white py-2 px-3 text-left font-semibold">Vehicle Description</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Ltrs</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Date</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Distance (KM)</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Fuel Burn (Km/L)</th>
                                    <th className="bg-[#555555] text-white py-2 px-3 text-left font-semibold">Fuel Burn (L/100Km)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No vehicle data found
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, idx) => (
                                        <tr key={item.id || idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors odd:bg-white even:bg-[#fff9f5]">
                                            <td className="py-2 px-3 font-semibold text-slate-800 align-middle">{item.description}</td>
                                            <td className="py-2 px-3 font-semibold text-[#138024] align-middle">{formatNumber(item.ltrs)} L</td>
                                            <td className="py-2 px-3 text-slate-500 align-middle">{item.date || '—'}</td>
                                            <td className="py-2 px-3 text-slate-600 align-middle">{item.distance > 0 ? formatNumber(item.distance) : '—'}</td>
                                            <td className="py-2 px-3 font-medium text-slate-600 align-middle">{item.kmPerLtr > 0 ? item.kmPerLtr.toFixed(2) : '—'}</td>
                                            <td className={`py-2 px-3 font-bold align-middle ${item.ltrsPer100Km > 15 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {item.ltrsPer100Km > 0 ? `${item.ltrsPer100Km.toFixed(1)} L/100Km` : '—'}
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
                            <p className="text-sm text-muted-foreground">
                                Showing {paginatedData.length} of {filteredData.length} transactions
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
                                <span className="flex items-center px-3 text-sm">
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
        </PageContainer>
    );
}

