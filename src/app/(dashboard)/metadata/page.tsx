// src/app/(dashboard)/metadata/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    Search, 
    Download, 
    RotateCcw, 
    Sliders,
    Edit2,
    X,
    Car,
    Save
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { formatNumber, exportToCSV } from '@/lib/utils';
import { useClientStore } from '@/services/api';

export interface VehicleMetadataRecord {
    id: string;
    asset: string; // Vehicle Rego (e.g., BFE131)
    fleetId: string; // Fleet ID (e.g., FL-101)
    dept: string; // Department (e.g., Security, (10) TV, (2) SMT)
    year: number | string;
    make: string; // TOYOTA, FORD, etc.
    model: string; // HI-ACE, RANGER, etc.
    classType: string; // 15 SEAT, DBLCAB, LSUV, etc.
    modeOfUse: string; // On-Duty Operational (24/7), Personal (24/7), etc.
    monthlyMileageAllowance: number | string; // KM
    burnRate: number | string; // L/100KM
    fuelLimit: number | string; // L or 'No Limit'
    standardBRate: number | string;
}

const INITIAL_DEMO_DATA: VehicleMetadataRecord[] = [
    {
        id: '1',
        asset: 'BFE131',
        fleetId: 'FL-101',
        dept: 'Security',
        year: 2025,
        make: 'TOYOTA',
        model: 'HI-ACE',
        classType: '15 SEAT',
        modeOfUse: 'On-Duty Operational (24/7)',
        monthlyMileageAllowance: '-',
        burnRate: 12,
        fuelLimit: 'No Limit',
        standardBRate: 9,
    },
    {
        id: '2',
        asset: 'BGZ364',
        fleetId: 'FL-102',
        dept: '(10) TV',
        year: 2023,
        make: 'FORD',
        model: 'RANGER',
        classType: 'DBLCAB',
        modeOfUse: 'On-Duty Operational (24/7)',
        monthlyMileageAllowance: 400,
        burnRate: 17,
        fuelLimit: 70,
        standardBRate: 6,
    },
    {
        id: '3',
        asset: 'BHA990',
        fleetId: 'FL-103',
        dept: '(2) SMT',
        year: 2023,
        make: 'TOYOTA',
        model: 'FORTUNER',
        classType: 'LSUV',
        modeOfUse: 'Personal (24/7)',
        monthlyMileageAllowance: 1500,
        burnRate: 15,
        fuelLimit: 225,
        standardBRate: 7,
    },
    {
        id: '4',
        asset: 'BGW537',
        fleetId: 'FL-104',
        dept: '(2) SMT',
        year: 2023,
        make: 'HYUNDAI',
        model: 'TUCSON',
        classType: 'MSUV',
        modeOfUse: 'Personal (24/7)',
        monthlyMileageAllowance: 1500,
        burnRate: 14,
        fuelLimit: 210,
        standardBRate: 7,
    },
    {
        id: '5',
        asset: 'BEF900',
        fleetId: 'FL-105',
        dept: '(14) FOUNDATION',
        year: 2013,
        make: 'ISUZU',
        model: 'D-MAX',
        classType: 'DBLCAB',
        modeOfUse: 'Regular Operational Hours',
        monthlyMileageAllowance: 700,
        burnRate: 17,
        fuelLimit: 120,
        standardBRate: 6,
    },
    {
        id: '6',
        asset: 'BGA411',
        fleetId: 'FL-106',
        dept: '(19) POOL',
        year: 2021,
        make: 'MAZDA',
        model: 'BT-50',
        classType: 'SGLCAB',
        modeOfUse: 'Upon Request',
        monthlyMileageAllowance: 3100,
        burnRate: 17,
        fuelLimit: 530,
        standardBRate: 6,
    },
    {
        id: '7',
        asset: 'BFR347',
        fleetId: 'FL-107',
        dept: '(15) MFS',
        year: 2019,
        make: 'FORD',
        model: 'RANGER',
        classType: 'DBLCAB',
        modeOfUse: 'Personal (24/7)',
        monthlyMileageAllowance: 1000,
        burnRate: 17,
        fuelLimit: 170,
        standardBRate: 6,
    },
    {
        id: '8',
        asset: 'BGV702',
        fleetId: 'FL-108',
        dept: '(2) SMT',
        year: 2023,
        make: 'FORD',
        model: 'RANGER',
        classType: 'DBLCAB',
        modeOfUse: 'Personal (24/7)',
        monthlyMileageAllowance: 1500,
        burnRate: 17,
        fuelLimit: 255,
        standardBRate: 6,
    },
    {
        id: '9',
        asset: 'BGM794',
        fleetId: 'FL-109',
        dept: '(10) TV',
        year: 2022,
        make: 'FORD',
        model: 'RANGER',
        classType: 'DBLCAB',
        modeOfUse: 'Personal (24/7)',
        monthlyMileageAllowance: 1000,
        burnRate: 17,
        fuelLimit: 170,
        standardBRate: 6,
    },
    {
        id: '10',
        asset: 'BGV703',
        fleetId: 'FL-110',
        dept: '(8) TECHNICAL',
        year: 2023,
        make: 'FORD',
        model: 'RANGER',
        classType: 'DBLCAB',
        modeOfUse: 'Personal (24/7)',
        monthlyMileageAllowance: 1000,
        burnRate: 17,
        fuelLimit: 170,
        standardBRate: 6,
    }
];

export default function MetadataPage() {
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [records, setRecords] = useState<VehicleMetadataRecord[]>(INITIAL_DEMO_DATA);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMake, setSelectedMake] = useState('');

    // Modal Popup state for Editing
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<VehicleMetadataRecord | null>(null);
    const [formData, setFormData] = useState<Partial<VehicleMetadataRecord>>({});

    // Pagination & Dynamic display size state
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);
    const [pageSizeMode, setPageSizeMode] = useState<'auto' | number>('auto');

    // Load from LocalStorage or initialize
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storageKey = `vehicle_metadata_${selectedClient.clientid}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                try {
                    setRecords(JSON.parse(stored));
                } catch {
                    setRecords(INITIAL_DEMO_DATA);
                }
            } else {
                setRecords(INITIAL_DEMO_DATA);
            }
        }
    }, [selectedClient]);

    const saveRecordsToStorage = (updatedRecords: VehicleMetadataRecord[]) => {
        setRecords(updatedRecords);
        if (typeof window !== 'undefined') {
            const storageKey = `vehicle_metadata_${selectedClient.clientid}`;
            localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
        }
    };

    // Calculate dynamic rows to fit viewport without scroll overflow
    useEffect(() => {
        if (pageSizeMode !== 'auto') {
            setPageSize(pageSizeMode);
            return;
        }

        const computeRows = () => {
            if (tableContainerRef.current) {
                const containerHeight = tableContainerRef.current.clientHeight;
                const headerHeight = 34; // <thead> height
                const scrollbarHeight = 10; // horizontal scrollbar allowance
                const rowHeight = 33; // precise <tr> height with py-1.5
                const availableForRows = containerHeight - headerHeight - scrollbarHeight;
                if (availableForRows > 0) {
                    const exactFit = Math.max(5, Math.floor(availableForRows / rowHeight));
                    setPageSize(exactFit);
                }
            } else if (typeof window !== 'undefined') {
                const overhead = 280;
                const availableHeight = window.innerHeight - overhead;
                const rowHeight = 33;
                const calculatedRows = Math.max(5, Math.floor(availableHeight / rowHeight));
                setPageSize(calculatedRows);
            }
        };

        computeRows();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && tableContainerRef.current) {
            observer = new ResizeObserver(() => {
                computeRows();
            });
            observer.observe(tableContainerRef.current);
        }

        window.addEventListener('resize', computeRows);
        return () => {
            if (observer) observer.disconnect();
            window.removeEventListener('resize', computeRows);
        };
    }, [pageSizeMode]);

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const handleReset = () => {
        setSearchInput('');
        setSearch('');
        setSelectedDept('');
        setSelectedMake('');
        setPage(1);
    };

    // Open center modal to edit
    const handleOpenEdit = (rec: VehicleMetadataRecord) => {
        setEditingRecord(rec);
        setFormData({ ...rec });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRecord) return;

        const updated = records.map((r) =>
            r.id === editingRecord.id ? ({ ...r, ...formData } as VehicleMetadataRecord) : r
        );
        saveRecordsToStorage(updated);
        setIsEditModalOpen(false);
    };

    // Filter data
    const departments = Array.from(new Set(records.map((r) => r.dept).filter(Boolean)));
    const makes = Array.from(new Set(records.map((r) => r.make).filter(Boolean)));

    const filteredData = records.filter((item) => {
        const query = search.toLowerCase();
        const matchesSearch =
            !search ||
            item.asset.toLowerCase().includes(query) ||
            item.fleetId.toLowerCase().includes(query) ||
            item.make.toLowerCase().includes(query) ||
            item.model.toLowerCase().includes(query) ||
            item.dept.toLowerCase().includes(query);

        const matchesDept = !selectedDept || item.dept === selectedDept;
        const matchesMake = !selectedMake || item.make === selectedMake;

        return matchesSearch && matchesDept && matchesMake;
    });

    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

    const handleExport = () => {
        if (filteredData.length === 0) return;
        const headers = [
            'Asset',
            'Fleet ID',
            'Dept',
            'Year',
            'Make',
            'Model',
            'Class',
            'Mode of Use',
            'MONTHLY MILEAGE ALLOWANCE(KM)',
            'BURN RATE (L/100KM)',
            'FUEL LIMIT (L)',
            'Standard B/Rate',
        ];
        const rows = filteredData.map((item) => [
            item.asset,
            item.fleetId,
            item.dept,
            item.year,
            item.make,
            item.model,
            item.classType,
            item.modeOfUse,
            item.monthlyMileageAllowance,
            item.burnRate,
            item.fuelLimit,
            item.standardBRate,
        ]);
        exportToCSV(`vehicle_metadata_${selectedClient.clientid}.csv`, headers, rows);
    };

    return (
        <PageContainer className="p-2 sm:p-3 space-y-0 h-full flex flex-col overflow-hidden relative">
            <Card className="rounded border border-slate-200 shadow-sm p-2.5 mb-0 flex-1 flex flex-col overflow-hidden">
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden justify-between">
                    {/* Filter bar container matching single horizontal row structure */}
                    <div className="mb-2 py-1.5 px-3 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-visible">
                        <div className="flex flex-wrap items-end justify-between gap-2.5">
                            {/* Left Filters Group */}
                            <div className="flex flex-wrap items-end gap-2.5 shrink-0">
                                {/* Total Assets Metric */}
                                <div className="flex flex-col gap-1 shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Total Assets
                                    </label>
                                    <div className="flex items-center px-3 border border-slate-200 bg-white rounded h-8 shadow-xs">
                                        <span className="text-xs font-bold text-[#138024] whitespace-nowrap">
                                            {filteredData.length} Vehicles
                                        </span>
                                    </div>
                                </div>

                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1 w-[200px] sm:w-[240px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Search Rego / Fleet
                                    </label>
                                    <div className="flex h-8">
                                        <span className="flex items-center px-2.5 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                                            <Search className="h-3 w-3" />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search asset, fleet, make..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            className="w-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                                        />
                                    </div>
                                </div>

                                {/* Department Filter */}
                                <div className="flex flex-col gap-1 w-[140px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Department
                                    </label>
                                    <select
                                        value={selectedDept}
                                        onChange={(e) => {
                                            setSelectedDept(e.target.value);
                                            setPage(1);
                                        }}
                                        className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map((dept) => (
                                            <option key={dept} value={dept}>
                                                {dept}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Make Filter */}
                                <div className="flex flex-col gap-1 w-[120px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Make
                                    </label>
                                    <select
                                        value={selectedMake}
                                        onChange={(e) => {
                                            setSelectedMake(e.target.value);
                                            setPage(1);
                                        }}
                                        className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    >
                                        <option value="">All Makes</option>
                                        {makes.map((make) => (
                                            <option key={make} value={make}>
                                                {make}
                                            </option>
                                        ))}
                                    </select>
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

                    {/* Metadata Table matching the Transactions page design */}
                    <div
                        ref={tableContainerRef}
                        className="overflow-x-auto overflow-y-auto border border-slate-200 shadow-xs rounded mb-1.5 flex-1 min-h-0"
                    >
                        <table className="w-full text-sm border-collapse whitespace-nowrap">
                            <thead className="sticky top-0 z-10 shadow-xs">
                                <tr>
                                    <th className="bg-[#f26522] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                                        Asset
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                                        Fleet ID
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                                        Dept
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-center font-semibold sticky top-0 z-10">
                                        Year
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                                        Make
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                                        Model
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                                        Class
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                                        Mode of Use
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-right font-semibold sticky top-0 z-10">
                                        MONTHLY MILEAGE ALLOWANCE(KM)
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-right font-semibold sticky top-0 z-10">
                                        BURN RATE (L/100KM)
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-right font-semibold sticky top-0 z-10">
                                        FUEL LIMIT (L)
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-right font-semibold sticky top-0 z-10">
                                        Standard B/Rate
                                    </th>
                                    <th className="bg-[#222222] text-white py-2 px-3 text-center font-semibold sticky top-0 z-10">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No vehicle found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, idx) => (
                                        <tr
                                            key={item.id || idx}
                                            className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors odd:bg-white even:bg-[#fff9f5]"
                                        >
                                            <td className="py-1.5 px-3 font-bold text-slate-900 align-middle">
                                                {item.asset}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle font-medium">
                                                {item.fleetId}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.dept}
                                            </td>
                                            <td className="py-1.5 px-3 text-center text-slate-600 align-middle">
                                                {item.year}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.make}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.model}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.classType}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle text-xs">
                                                {item.modeOfUse}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 align-middle">
                                                {typeof item.monthlyMileageAllowance === 'number'
                                                    ? formatNumber(item.monthlyMileageAllowance)
                                                    : item.monthlyMileageAllowance}
                                            </td>
                                            <td className="py-1.5 px-3 text-right text-slate-600 align-middle">
                                                {item.burnRate}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 align-middle">
                                                {typeof item.fuelLimit === 'number'
                                                    ? `${formatNumber(item.fuelLimit)} L`
                                                    : item.fuelLimit}
                                            </td>
                                            <td className="py-1.5 px-3 text-right text-slate-600 align-middle">
                                                {item.standardBRate}
                                            </td>
                                            <td className="py-1.5 px-3 text-center align-middle">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="h-7 px-2.5 text-xs text-[#f26522] border-[#f26522]/30 hover:bg-orange-50 hover:text-[#d45316] font-semibold flex items-center gap-1 rounded shadow-2xs mx-auto"
                                                    title="Edit Vehicle"
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                    Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filteredData.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-0.5 px-2 shrink-0 border-t border-slate-100">
                            <div className="flex items-center gap-4 flex-wrap">
                                <p className="text-xs sm:text-sm text-slate-500">
                                    Showing <span className="font-semibold text-slate-800">{paginatedData.length}</span> of <span className="font-semibold text-slate-800">{filteredData.length}</span> entries
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span>Rows:</span>
                                    <select
                                        value={pageSizeMode}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === 'auto') {
                                                setPageSizeMode('auto');
                                            } else {
                                                setPageSizeMode(Number(val));
                                            }
                                            setPage(1);
                                        }}
                                        className="border border-slate-200 rounded px-2 py-1 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#f26522] cursor-pointer"
                                    >
                                        <option value="auto">Auto ({pageSizeMode === 'auto' ? pageSize : 'Fit screen'})</option>
                                        <option value={8}>8</option>
                                        <option value={10}>10</option>
                                        <option value={15}>15</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="h-7 px-2.5 text-xs border-slate-200 bg-white"
                                >
                                    Previous
                                </Button>
                                <span className="px-2 font-medium text-slate-700 text-xs">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="h-7 px-2.5 text-xs border-slate-200 bg-white"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Centered Modal Popup for Editing Vehicle */}
            {isEditModalOpen && editingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200">
                    <div 
                        className="fixed inset-0"
                        onClick={() => setIsEditModalOpen(false)}
                    />
                    <div className="relative w-full max-w-xl bg-white shadow-2xl rounded-2xl z-10 border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-linear-to-r from-orange-500/15 via-green-500/10 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[#f26522] text-white rounded-lg shadow-xs">
                                    <Car className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">
                                        Edit Vehicle
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Asset: <span className="font-bold text-slate-800">{editingRecord.asset}</span> ({editingRecord.fleetId})
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsEditModalOpen(false)}
                                className="h-8 w-8 p-0 rounded-full hover:bg-slate-200/60 text-slate-500"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Modal Body / Form */}
                        <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Vehicle Rego (Asset)</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={formData.asset || ''}
                                        className="w-full h-8 px-2.5 border border-slate-200 bg-slate-100 rounded text-slate-600 font-bold cursor-not-allowed"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Fleet ID</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={formData.fleetId || ''}
                                        className="w-full h-8 px-2.5 border border-slate-200 bg-slate-100 rounded text-slate-600 font-bold cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Department</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Security, (10) TV"
                                        value={formData.dept || ''}
                                        onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Year</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 2024"
                                        value={formData.year || ''}
                                        onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Make</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. TOYOTA, FORD"
                                        value={formData.make || ''}
                                        onChange={(e) => setFormData({ ...formData, make: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Model</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. HI-ACE, RANGER"
                                        value={formData.model || ''}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Class</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 15 SEAT, DBLCAB"
                                        value={formData.classType || ''}
                                        onChange={(e) => setFormData({ ...formData, classType: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Mode of Use</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. On-Duty Operational (24/7)"
                                        value={formData.modeOfUse || ''}
                                        onChange={(e) => setFormData({ ...formData, modeOfUse: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Monthly Mileage Allowance (KM)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 1500 or -"
                                        value={formData.monthlyMileageAllowance !== undefined ? formData.monthlyMileageAllowance : ''}
                                        onChange={(e) => setFormData({ ...formData, monthlyMileageAllowance: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Burn Rate (L/100KM)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 17"
                                        value={formData.burnRate !== undefined ? formData.burnRate : ''}
                                        onChange={(e) => setFormData({ ...formData, burnRate: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Fuel Limit (L)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 225 or No Limit"
                                        value={formData.fuelLimit !== undefined ? formData.fuelLimit : ''}
                                        onChange={(e) => setFormData({ ...formData, fuelLimit: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Standard B/Rate</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 7"
                                        value={formData.standardBRate !== undefined ? formData.standardBRate : ''}
                                        onChange={(e) => setFormData({ ...formData, standardBRate: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    />
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="h-8 px-3.5 text-xs font-semibold"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold h-8 px-4 flex items-center gap-1.5 shadow-xs"
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
