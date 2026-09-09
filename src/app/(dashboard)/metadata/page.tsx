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
    Save,
    ChevronDown,
    FileSpreadsheet,
    FileText,
    FileDown,
    Plus
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { formatNumber, exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils';
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

    // Modal Popup state for Add / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingRecord, setEditingRecord] = useState<VehicleMetadataRecord | null>(null);
    const [formData, setFormData] = useState<Partial<VehicleMetadataRecord>>({});
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

    // Open modal to add new vehicle
    const handleOpenAdd = () => {
        setModalMode('add');
        setEditingRecord(null);
        setFormData({
            asset: '',
            fleetId: '',
            dept: '',
            year: new Date().getFullYear(),
            make: '',
            model: '',
            classType: '',
            modeOfUse: 'On-Duty Operational (24/7)',
            monthlyMileageAllowance: '-',
            burnRate: '',
            fuelLimit: 'No Limit',
            standardBRate: '',
        });
        setIsModalOpen(true);
    };

    // Open modal to edit existing vehicle
    const handleOpenEdit = (rec: VehicleMetadataRecord) => {
        setModalMode('edit');
        setEditingRecord(rec);
        setFormData({ ...rec });
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (modalMode === 'add') {
            if (!formData.asset?.trim()) {
                return;
            }
            const newRecord: VehicleMetadataRecord = {
                id: Date.now().toString(),
                asset: (formData.asset || '').trim().toUpperCase(),
                fleetId: (formData.fleetId || '').trim().toUpperCase() || `FL-${100 + records.length + 1}`,
                dept: formData.dept?.trim() || 'General',
                year: formData.year || new Date().getFullYear(),
                make: (formData.make || '').trim().toUpperCase() || 'N/A',
                model: (formData.model || '').trim().toUpperCase() || 'N/A',
                classType: formData.classType?.trim() || '-',
                modeOfUse: formData.modeOfUse?.trim() || 'On-Duty Operational (24/7)',
                monthlyMileageAllowance: formData.monthlyMileageAllowance !== undefined && formData.monthlyMileageAllowance !== '' 
                    ? (isNaN(Number(formData.monthlyMileageAllowance)) ? formData.monthlyMileageAllowance : Number(formData.monthlyMileageAllowance))
                    : '-',
                burnRate: formData.burnRate !== undefined && formData.burnRate !== '' 
                    ? (isNaN(Number(formData.burnRate)) ? formData.burnRate : Number(formData.burnRate))
                    : '-',
                fuelLimit: formData.fuelLimit !== undefined && formData.fuelLimit !== '' 
                    ? (isNaN(Number(formData.fuelLimit)) ? formData.fuelLimit : Number(formData.fuelLimit))
                    : 'No Limit',
                standardBRate: formData.standardBRate !== undefined && formData.standardBRate !== '' 
                    ? (isNaN(Number(formData.standardBRate)) ? formData.standardBRate : Number(formData.standardBRate))
                    : '-',
            };
            const updated = [newRecord, ...records];
            saveRecordsToStorage(updated);
            setIsModalOpen(false);
        } else {
            if (!editingRecord) return;
            const updated = records.map((r) =>
                r.id === editingRecord.id
                    ? ({
                          ...r,
                          ...formData,
                          asset: formData.asset ? formData.asset.trim().toUpperCase() : r.asset,
                          fleetId: formData.fleetId ? formData.fleetId.trim().toUpperCase() : r.fleetId,
                      } as VehicleMetadataRecord)
                    : r
            );
            saveRecordsToStorage(updated);
            setIsModalOpen(false);
        }
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

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        if (filteredData.length === 0) {
            setExportOpen(false);
            return;
        }
        setIsExporting(format);
        try {
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

            const clientLabel = selectedClient?.clientid || 'metadata';

            if (format === 'csv') {
                exportToCSV(`vehicle_metadata_${clientLabel}.csv`, headers, rows);
            } else if (format === 'excel') {
                exportToExcel(`vehicle_metadata_${clientLabel}.xlsx`, headers, rows, 'Vehicle Metadata');
            } else if (format === 'pdf') {
                exportToPDF('Vehicle Metadata Report', headers, rows);
            }
        } catch (err) {
            console.error('Failed to export vehicle metadata:', err);
        } finally {
            setIsExporting(null);
            setExportOpen(false);
        }
    };

    return (
        <PageContainer className="p-2 sm:p-3 space-y-0 h-full flex flex-col overflow-hidden relative">
            <Card className="rounded border border-slate-200 shadow-sm p-2.5 mb-0 flex-1 flex flex-col overflow-hidden">
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden justify-between">
                    {/* Filter bar container matching single horizontal row structure */}
                    <div className="mb-2 py-1.5 px-3 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-x-auto overflow-y-visible">
                        <div className="flex items-end justify-between gap-2 min-w-max">
                            {/* Left Filters Group */}
                            <div className="flex items-end gap-2 shrink-0">
                                {/* Total Assets Metric */}
                                <div className="flex flex-col gap-1 shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Total Assets
                                    </label>
                                    <div className="flex items-center px-2.5 border border-slate-200 bg-white rounded h-8 shadow-xs">
                                        <span className="text-xs font-bold text-[#138024] whitespace-nowrap">
                                            {filteredData.length} Vehicles
                                        </span>
                                    </div>
                                </div>

                                {/* Search Input Group */}
                                <div className="flex flex-col gap-1 w-[180px] lg:w-[210px] shrink-0">
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
                                <div className="flex flex-col gap-1 w-[130px] shrink-0">
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
                                <div className="flex flex-col gap-1 w-[110px] shrink-0">
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
                                {/* Add Vehicle Button */}
                                <Button
                                    type="button"
                                    onClick={handleOpenAdd}
                                    className="bg-[#137e19] hover:bg-[#0e5c12] text-xs font-semibold text-white px-3 rounded h-8 border border-[#137e19] transition-colors duration-200 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                                    title="Add New Vehicle"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Vehicle
                                </Button>

                                {/* Search Button */}
                                <Button
                                    onClick={handleSearch}
                                    className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-3 rounded h-8 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                    <Sliders className="h-3.5 w-3.5" />
                                    Search
                                </Button>

                                {/* Reset Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    className="h-8 px-2.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap"
                                    title="Reset filters"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reset
                                </Button>

                                {/* Export with 3 options: Excel, CSV, PDF */}
                                <div className="relative" ref={exportRef}>
                                    <Button
                                        type="button"
                                        onClick={() => setExportOpen((prev) => !prev)}
                                        className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold rounded h-8 px-2.5 border border-[#f26522] transition-colors duration-200 flex items-center justify-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
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

            {/* Centered Modal Popup for Add / Edit Vehicle */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200">
                    <div 
                        className="fixed inset-0"
                        onClick={() => setIsModalOpen(false)}
                    />
                    <div className="relative w-full max-w-xl bg-white shadow-2xl rounded-2xl z-10 border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-linear-to-r from-orange-500/15 via-green-500/10 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 ${modalMode === 'add' ? 'bg-[#137e19]' : 'bg-[#f26522]'} text-white rounded-lg shadow-xs`}>
                                    <Car className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">
                                        {modalMode === 'add' ? 'Add Vehicle' : 'Edit Vehicle'}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {modalMode === 'add' ? (
                                            'Enter new fleet vehicle specifications, allowances and fuel limits'
                                        ) : (
                                            <>Asset: <span className="font-bold text-slate-800">{editingRecord?.asset}</span> ({editingRecord?.fleetId})</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsModalOpen(false)}
                                className="h-8 w-8 p-0 rounded-full hover:bg-slate-200/60 text-slate-500 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Modal Body / Form */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">
                                        Vehicle Rego (Asset) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. BFE131"
                                        value={formData.asset || ''}
                                        onChange={(e) => setFormData({ ...formData, asset: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900 font-semibold"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">
                                        Fleet ID <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. FL-101"
                                        value={formData.fleetId || ''}
                                        onChange={(e) => setFormData({ ...formData, fleetId: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900 font-semibold"
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
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Year</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 2025"
                                        value={formData.year || ''}
                                        onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
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
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Model</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. HI-ACE, RANGER"
                                        value={formData.model || ''}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
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
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Mode of Use</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. On-Duty Operational (24/7)"
                                        value={formData.modeOfUse || ''}
                                        onChange={(e) => setFormData({ ...formData, modeOfUse: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
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
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Burn Rate (L/100KM)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 17"
                                        value={formData.burnRate !== undefined ? formData.burnRate : ''}
                                        onChange={(e) => setFormData({ ...formData, burnRate: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
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
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Standard B/Rate</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 7"
                                        value={formData.standardBRate !== undefined ? formData.standardBRate : ''}
                                        onChange={(e) => setFormData({ ...formData, standardBRate: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-8 px-3.5 text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className={`${
                                        modalMode === 'add' ? 'bg-[#137e19] hover:bg-[#0e5c12]' : 'bg-[#f26522] hover:bg-[#d94f12]'
                                    } text-white text-xs font-semibold h-8 px-4 flex items-center gap-1.5 shadow-xs cursor-pointer`}
                                >
                                    {modalMode === 'add' ? <Plus className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                    {modalMode === 'add' ? 'Add Vehicle' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
