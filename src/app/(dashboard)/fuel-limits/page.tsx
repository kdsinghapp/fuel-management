// src/app/(dashboard)/fuel-limits/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, RefreshCw, RotateCcw, Sliders } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { fuelIssueService } from '@/services/fuelIssueService';
import { formatNumber, exportToCSV } from '@/lib/utils';
import { useClientStore } from '@/services/api';
import { DateRangePicker, DateRange, getDateRangeFromPreset } from '@/components/common/DateRangePicker';

interface FuelLimitRecord {
    id: string;
    asset: string; // RegistrationNo
    vehicleName: string; // DriverAttendant or Depot
    department: string;
    date: string;
    time: string;
    limitType: 'No Limit' | 'Limit';
    fuelLimit: number | 'No Limit';
    monthlyFuelUsed: number;
}

export default function FuelLimitsPage() {
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [allRecords, setAllRecords] = useState<any[]>([]);
    const [limits, setLimits] = useState<FuelLimitRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedLimitType, setSelectedLimitType] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>(getDateRangeFromPreset('30days'));

    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);

    useEffect(() => {
        loadLimitsAndUsage();
    }, [selectedClient, dateRange.startDate, dateRange.endDate, dateRange.preset]);

    const loadLimitsAndUsage = async () => {
        try {
            setLoading(true);

            // Fetch live transactions from API (similar to Fuel Efficiency)
            const response = await fuelIssueService.getFuelIssues({
                page: 1,
                pageSize: 100000,
                startDate: dateRange.startDate || undefined,
                endDate: dateRange.endDate || undefined,
            });

            // Load saved limit configurations from localStorage
            let savedConfig: Record<string, { limitType: 'No Limit' | 'Limit'; fuelLimit: number | 'No Limit' }> = {};
            if (typeof window !== 'undefined') {
                const stored = localStorage.getItem(`fuel_limits_config_${selectedClient.clientid}`);
                if (stored) {
                    try {
                        savedConfig = JSON.parse(stored);
                    } catch {
                        savedConfig = {};
                    }
                }
            }

            // Map each individual transaction without combining
            const records: FuelLimitRecord[] = response.data.map((tx: any, idx: number) => {
                const vehicleId = (tx.vehicleId && tx.vehicleId.trim() !== '' ? tx.vehicleId : (tx.driverAttendant || 'UNKNOWN')).toUpperCase();
                const custom = savedConfig[vehicleId] || { limitType: 'No Limit', fuelLimit: 'No Limit' };
                const qty = Number(tx.fuelQuantity) || 0;
                const txDate = tx.date || tx.Date || tx.lastDate || (tx.createdAt ? tx.createdAt.split('T')[0] : '');
                const txTime = tx.time || tx.Time || (tx.createdAt ? tx.createdAt.split('T')[1]?.replace('Z', '') : '');

                return {
                    id: `${tx.transactionId || idx}`,
                    asset: vehicleId,
                    vehicleName: tx.driverAttendant || tx.depot || 'Fleet Vehicle',
                    department: tx.depot || 'General',
                    date: txDate,
                    time: txTime,
                    limitType: custom.limitType,
                    fuelLimit: custom.fuelLimit,
                    monthlyFuelUsed: Number(qty.toFixed(2)),
                };
            });

            // Sort by latest date/time descending (matching Fuel Efficiency)
            records.sort((a, b) => {
                const timeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
                const timeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
                return timeB - timeA;
            });

            setLimits(records);

            // Load all records once for DateRangePicker count logic if needed
            if (allRecords.length === 0 || dateRange.preset === 'all') {
                setAllRecords(response.data);
            }
        } catch (err) {
            console.error('Failed to load live limits usage:', err);
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
        setSelectedDepartment('');
        setSelectedLimitType('');
        setDateRange(defaultRange);
        setPage(1);
    };

    const filteredData = limits.filter((item) => {
        const query = search.toLowerCase();
        const matchesSearch = item.asset.toLowerCase().includes(query) ||
            item.vehicleName.toLowerCase().includes(query) ||
            item.department.toLowerCase().includes(query) ||
            item.date.toLowerCase().includes(query);

        const matchesDept = selectedDepartment ? item.department === selectedDepartment : true;
        const matchesLimitType = selectedLimitType ? item.limitType === selectedLimitType : true;

        return matchesSearch && matchesDept && matchesLimitType;
    });

    const totalFuelUsed = filteredData.reduce((sum, item) => sum + (Number(item.monthlyFuelUsed) || 0), 0);

    // Pagination calculations
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

    const handleExport = () => {
        if (filteredData.length === 0) return;
        const headers = ['Asset (Rego)', 'Vehicle Name', 'Department', 'Date', 'Limit Type', 'Fuel Limit (L)', 'Monthly Fuel Used (L)', 'Fuel Balance Remaining'];
        const rows = filteredData.map(item => {
            const limitVal = item.fuelLimit;
            const remaining = limitVal === 'No Limit' ? 'No Limit' : limitVal - item.monthlyFuelUsed;
            return [
                item.asset,
                item.vehicleName,
                item.department,
                item.date,
                item.limitType,
                item.fuelLimit,
                item.monthlyFuelUsed,
                typeof remaining === 'number' ? Number(remaining.toFixed(2)) : remaining
            ];
        });
        rows.push(['TOTAL', '', '', '', '', '', Number(totalFuelUsed.toFixed(2)), '']);
        exportToCSV('fuel_limits.csv', headers, rows);
    };

    const uniqueDepartments = Array.from(new Set(limits.map(l => l.department))).filter(Boolean);

    if (loading) {
        return (
            <PageContainer>
                <div className="flex items-center justify-center min-h-[400px]">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <Card className="rounded border border-slate-200 shadow-sm p-4 mb-4 overflow-visible">
                <CardContent className="p-0 overflow-visible">
                    {/* Filter bar container matching single horizontal row structure */}
                    <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-visible">
                        <div className="flex flex-wrap items-end justify-between gap-2.5">
                            {/* Left Filters Group - All in 1 line */}
                            <div className="flex flex-wrap items-end gap-2.5 shrink-0">
                                {/* Total Summary Field */}
                                <div className="flex flex-col gap-1 shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Fuel Used</label>
                                    <div className="flex items-center px-3 border border-slate-200 bg-white rounded h-8 shadow-xs">
                                        <span className="text-xs font-bold text-[#138024] whitespace-nowrap">
                                            {formatNumber(totalFuelUsed, 1)} L
                                        </span>
                                    </div>
                                </div>

                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1 w-[180px] sm:w-[210px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Search vehicles or drivers</label>
                                    <div className="flex h-8">
                                        <span className="flex items-center px-2.5 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                            <Search className="h-3 w-3" />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search asset or driver..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            className="w-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                        />
                                    </div>
                                </div>
                                {/* Limit Type Dropdown */}
                                <div className="flex flex-col gap-1 w-[115px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Limit Type</label>
                                    <select
                                        value={selectedLimitType}
                                        onChange={(e) => {
                                            setSelectedLimitType(e.target.value);
                                            setPage(1);
                                        }}
                                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 cursor-pointer w-full"
                                    >
                                        <option value="">All Types</option>
                                        <option value="Limit">Limit</option>
                                        <option value="No Limit">No Limit</option>
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
                                    <th className="bg-[#f26522] text-white py-2 px-3 text-left font-semibold">Asset (Rego)</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Vehicle Name</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Department</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Date</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Limit Type</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">FUEL LIMIT (L)</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">MONTHLY FUEL USED (L)</th>
                                    <th className="bg-[#555555] text-white py-2 px-3 text-left font-semibold">FUEL BALANCE REMAINING</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No limits configuration found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, idx) => {
                                        const limitVal = item.fuelLimit;
                                        const remaining = limitVal === 'No Limit' ? 'No Limit' : limitVal - item.monthlyFuelUsed;
                                        return (
                                            <tr key={item.id || idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors odd:bg-white even:bg-[#fff9f5]">
                                                <td className="py-2 px-3 font-semibold text-slate-800 align-middle">{item.asset}</td>
                                                <td className="py-2 px-3 text-slate-600 align-middle">{item.vehicleName}</td>
                                                <td className="py-2 px-3 text-slate-500 align-middle">{item.department}</td>
                                                <td className="py-2 px-3 text-slate-500 align-middle">{item.date || '—'}</td>
                                                <td className="py-2 px-3 text-slate-600 align-middle">{item.limitType}</td>
                                                <td className="py-2 px-3 font-semibold text-slate-800 align-middle">
                                                    {typeof limitVal === 'number' ? `${formatNumber(limitVal)} L` : limitVal}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-[#138024] align-middle">{formatNumber(item.monthlyFuelUsed)} L</td>
                                                <td className={`py-2 px-3 font-bold align-middle ${typeof remaining === 'number' && remaining < 20 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {typeof remaining === 'number' ? `${formatNumber(Number(remaining.toFixed(2)))} L` : remaining}
                                                </td>
                                            </tr>
                                        );
                                    })
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

