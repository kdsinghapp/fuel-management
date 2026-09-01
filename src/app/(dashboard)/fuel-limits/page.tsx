// src/app/(dashboard)/fuel-limits/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Download, AlertTriangle, Sliders, RefreshCw, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { fuelIssueService } from '@/services/fuelIssueService';
import { formatNumber, exportToCSV } from '@/lib/utils';
import { useClientStore } from '@/services/api';

interface FuelLimitRecord {
    asset: string; // RegistrationNo
    vehicleName: string; // DriverAttendant or Depot
    department: string;
    limitType: 'No Limit' | 'Limit';
    fuelLimit: number | 'No Limit';
    monthlyFuelUsed: number;
}

export default function FuelLimitsPage() {
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [limits, setLimits] = useState<FuelLimitRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedLimitType, setSelectedLimitType] = useState('');

    useEffect(() => {
        loadLimitsAndUsage();
    }, [selectedClient]);

    const loadLimitsAndUsage = async () => {
        try {
            setLoading(true);

            // Fetch live transactions from API
            const response = await fuelIssueService.getFuelIssues({
                page: 1,
                pageSize: 2000,
            });

            // Group transactions to find unique vehicles and sum monthly consumption
            const usageMap: Record<string, { ltrs: number; name: string; dept: string }> = {};
            response.data.forEach((tx: any) => {
                const vehicle = (tx.vehicleId || 'Unknown').toUpperCase();
                if (!usageMap[vehicle]) {
                    usageMap[vehicle] = {
                        ltrs: 0,
                        name: tx.driverAttendant || tx.depot || 'Fleet Vehicle',
                        dept: tx.depot || 'General'
                    };
                }
                usageMap[vehicle].ltrs += tx.fuelQuantity || 0;
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

            // Map everything to FuelLimitRecord
            const records: FuelLimitRecord[] = Object.keys(usageMap).map(vehicleId => {
                const live = usageMap[vehicleId];
                // Check if user set a custom limit, otherwise default to "No Limit"
                const custom = savedConfig[vehicleId] || { limitType: 'No Limit', fuelLimit: 'No Limit' };

                return {
                    asset: vehicleId,
                    vehicleName: live.name,
                    department: live.dept,
                    limitType: custom.limitType,
                    fuelLimit: custom.fuelLimit,
                    monthlyFuelUsed: Number(live.ltrs.toFixed(2))
                };
            });

            // Sort by monthly fuel used descending
            records.sort((a, b) => b.monthlyFuelUsed - a.monthlyFuelUsed);
            setLimits(records);
        } catch (err) {
            console.error('Failed to load live limits usage:', err);
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    const handleSearch = () => {
        setSearch(searchInput);
    };

    const handleReset = () => {
        setSearchInput('');
        setSearch('');
        setSelectedDepartment('');
        setSelectedLimitType('');
    };

    const handleExport = () => {
        if (filteredData.length === 0) return;
        const headers = ['Asset (Rego)', 'Vehicle Name', 'Department', 'Limit Type', 'Fuel Limit (L)', 'Monthly Fuel Used (L)'];
        const rows = filteredData.map(item => [
            item.asset,
            item.vehicleName,
            item.department,
            item.limitType,
            item.fuelLimit,
            item.monthlyFuelUsed
        ]);
        exportToCSV('fuel_limits.csv', headers, rows);
    };

    const filteredData = limits.filter((item) => {
        const query = search.toLowerCase();
        const matchesSearch = item.asset.toLowerCase().includes(query) ||
            item.vehicleName.toLowerCase().includes(query) ||
            item.department.toLowerCase().includes(query);

        const matchesDept = selectedDepartment ? item.department === selectedDepartment : true;
        const matchesLimitType = selectedLimitType ? item.limitType === selectedLimitType : true;

        return matchesSearch && matchesDept && matchesLimitType;
    });

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
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="font-semibold text-zinc-900 text-2xl leading-tight m-0">Fuel Limits</h2>
                    <span className="text-sm text-zinc-500 mt-1 inline-block">Monitor vehicle consumption limits and monthly usage thresholds</span>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => loadLimitsAndUsage()}
                        className="bg-[#3c8e75] hover:bg-[#317561] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                    <Button
                        onClick={handleExport}
                        className="bg-[#f26522] hover:bg-[#d94f12] text-sm font-semibold rounded px-4 py-2 flex items-center gap-1.5 transition-colors duration-200 border-0 h-10 shadow-sm text-white"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            <Card className="rounded border border-slate-200 shadow-sm p-4 mb-4">
                <CardContent className="p-0">
                    {/* Filter bar container matching the bootstrap grid structure */}
                    <div className="mb-4 py-2.5 px-4 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            {/* Left Filters Group */}
                            <div className="flex flex-wrap items-end gap-3 flex-1 min-w-[280px]">
                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1.5 min-w-[260px] flex-1 max-w-xs">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Search vehicles or drivers</label>
                                    <div className="flex h-8">
                                        <span className="flex items-center px-3 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                            <Search className="h-3 w-3" />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search asset or driver name..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            className="flex-1 border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                        />
                                    </div>
                                </div>

                                {/* Department Dropdown */}
                                <div className="flex flex-col gap-1.5 min-w-[160px]">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                                    <select
                                        value={selectedDepartment}
                                        onChange={(e) => setSelectedDepartment(e.target.value)}
                                        className="rounded border border-[#f26522] bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 cursor-pointer w-full"
                                    >
                                        <option value="">All Departments</option>
                                        {uniqueDepartments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Limit Type Dropdown */}
                                <div className="flex flex-col gap-1.5 min-w-[160px]">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Limit Type</label>
                                    <select
                                        value={selectedLimitType}
                                        onChange={(e) => setSelectedLimitType(e.target.value)}
                                        className="rounded border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 cursor-pointer w-full"
                                    >
                                        <option value="">All Types</option>
                                        <option value="Limit">Limit</option>
                                        <option value="No Limit">No Limit</option>
                                    </select>
                                </div>
                            </div>

                            {/* Right Action Buttons Group */}
                            <div className="flex items-end gap-2">
                                {/* Search Button */}
                                <Button
                                    onClick={handleSearch}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-4 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
                                >
                                    <Sliders className="h-3.5 w-3.5" />
                                    Search
                                </Button>

                                {/* Reset Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-8 px-4 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
                                    title="Reset filters"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reset
                                </Button>

                                {/* Export Button */}
                                <Button
                                    onClick={handleExport}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-4 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5"
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
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">Limit Type</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">FUEL LIMIT (L)</th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold">MONTHLY FUEL USED (L)</th>
                                    <th className="bg-[#555555] text-white py-2 px-3 text-left font-semibold">FUEL BALANCE REMAINING</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No limits configuration found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item, idx) => {
                                        const limitVal = item.fuelLimit;
                                        const remaining = limitVal === 'No Limit' ? 'No Limit' : limitVal - item.monthlyFuelUsed;
                                        return (
                                            <tr key={idx} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors odd:bg-white even:bg-[#fff9f5]">
                                                <td className="py-2 px-3 font-semibold text-slate-800 align-middle">{item.asset}</td>
                                                <td className="py-2 px-3 text-slate-600 align-middle">{item.vehicleName}</td>
                                                <td className="py-2 px-3 text-slate-500 align-middle">{item.department}</td>
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
                </CardContent>
            </Card>
        </PageContainer>
    );
}
