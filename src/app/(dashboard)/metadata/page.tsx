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
    Plus,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    Database,
    Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatNumber, exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils';
import { useClientStore } from '@/services/api';
import { fuelIssueService } from '@/services/fuelIssueService';

export interface VehicleDetailRecord {
    VehicleId?: number; // Present if saved in Azure SQL
    Asset: string;
    FleetId: string;
    Department: string;
    VehicleYear: number | string;
    Make: string;
    Model: string;
    VehicleClass: string;
    ModeOfUse: string;
    MonthlyMileageAllowanceKm: number | string;
    BurnRateLPer100Km: number | string;
    FuelLimitLitres: number | string;
    StandardBurnRate: number | string;
    Status: string;
    CreatedAt?: string;
    CreatedBy?: string;
    UpdatedAt?: string;
    UpdatedBy?: string;
    isSavedInDb?: boolean;
}

export default function VehicleDetailsPage() {
    const selectedClient = useClientStore((state) => state.selectedClient);
    const [records, setRecords] = useState<VehicleDetailRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMake, setSelectedMake] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');

    // Notification banner state
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Modal Popup state for Add / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [editingRecord, setEditingRecord] = useState<VehicleDetailRecord | null>(null);
    const [formData, setFormData] = useState<Partial<VehicleDetailRecord>>({});
    const [exportOpen, setExportOpen] = useState(false);
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    // Delete confirmation state
    const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<VehicleDetailRecord | null>(null);

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
    const [pageSize, setPageSize] = useState(10);
    const [pageSizeMode, setPageSizeMode] = useState<'auto' | number>('auto');

    // Auto dismiss notification after 4s
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Load data on mount or client change
    useEffect(() => {
        loadAllVehicles();
    }, [selectedClient]);

    const loadAllVehicles = async () => {
        try {
            setLoading(true);

            // 1. Fetch live transactions from Fuel Issues API
            const issuesRes = await fuelIssueService.getFuelIssues({
                page: 1,
                pageSize: 100000,
            });
            const rawTransactions = issuesRes.data || [];

            // 2. Fetch saved vehicle records from Azure SQL Database
            let dbRecords: any[] = [];
            try {
                const dbRes = await fetch('/api/vehicles');
                const dbJson = await dbRes.json();
                if (dbJson.success && Array.isArray(dbJson.data)) {
                    dbRecords = dbJson.data;
                }
            } catch (sqlErr) {
                console.warn('Could not fetch from Azure SQL:', sqlErr);
            }

            // Create lookup map of Azure SQL records by Asset (normalized upper case)
            const sqlMap = new Map<string, any>();
            dbRecords.forEach((rec) => {
                if (rec.Asset) {
                    sqlMap.set(rec.Asset.trim().toUpperCase(), rec);
                }
            });

            // 3. Extract and group unique vehicles from live transactions (same as Fuel Limits)
            const liveMap = new Map<string, {
                asset: string;
                fleetId: string;
                dept: string;
                litres: number;
                odometers: { odo: number; date: string; time: string }[];
            }>();

            rawTransactions.forEach((tx: any) => {
                const assetKey = (tx.registrationNo || tx.vehicleId || tx.fleetId || tx.driverAttendant || '').toString().trim().toUpperCase();
                if (!assetKey) return;

                if (!liveMap.has(assetKey)) {
                    liveMap.set(assetKey, {
                        asset: assetKey,
                        fleetId: tx.fleetId || tx.vehicleId || '',
                        dept: tx.depot || tx.department || selectedClient?.name || 'General',
                        litres: 0,
                        odometers: [],
                    });
                }

                const entry = liveMap.get(assetKey)!;
                if (tx.fleetId && (!entry.fleetId || entry.fleetId === '-')) {
                    entry.fleetId = tx.fleetId;
                }
                if (tx.depot && (!entry.dept || entry.dept === 'General')) {
                    entry.dept = tx.depot;
                }

                const qty = Number(tx.fuelQuantity) || 0;
                const odo = Number(tx.odometer) || 0;
                entry.litres += qty;

                if (odo > 0) {
                    entry.odometers.push({
                        odo,
                        date: tx.date || '',
                        time: tx.time || '',
                    });
                }
            });

            const mergedList: VehicleDetailRecord[] = [];
            const seenAssets = new Set<string>();

            // Process all vehicles derived from live transactions
            liveMap.forEach((v, assetKey) => {
                seenAssets.add(assetKey);

                // Calculate burn rate from odometers if available
                let calculatedBurnRate: number | string = '-';
                if (v.odometers.length >= 2) {
                    v.odometers.sort((a, b) => {
                        const timeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
                        const timeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
                        return timeA - timeB;
                    });
                    const minOdo = v.odometers[0].odo;
                    const maxOdo = v.odometers[v.odometers.length - 1].odo;
                    const dist = maxOdo - minOdo;
                    if (dist > 0 && v.litres > 0) {
                        calculatedBurnRate = Number(((v.litres / dist) * 100).toFixed(2));
                    }
                }

                const sqlItem = sqlMap.get(assetKey);
                if (sqlItem) {
                    // Vehicle exists in Azure SQL
                    mergedList.push({
                        VehicleId: sqlItem.VehicleId,
                        Asset: sqlItem.Asset || assetKey,
                        FleetId: sqlItem.FleetId || v.fleetId || '-',
                        Department: sqlItem.Department || v.dept || selectedClient?.name || 'Operations',
                        VehicleYear: sqlItem.VehicleYear ?? '-',
                        Make: sqlItem.Make || '-',
                        Model: sqlItem.Model || '-',
                        VehicleClass: sqlItem.VehicleClass || 'Light Vehicle',
                        ModeOfUse: sqlItem.ModeOfUse || 'Operational',
                        MonthlyMileageAllowanceKm: sqlItem.MonthlyMileageAllowanceKm != null ? sqlItem.MonthlyMileageAllowanceKm : '-',
                        BurnRateLPer100Km: sqlItem.BurnRateLPer100Km != null ? sqlItem.BurnRateLPer100Km : calculatedBurnRate,
                        FuelLimitLitres: sqlItem.FuelLimitLitres != null ? sqlItem.FuelLimitLitres : '-',
                        StandardBurnRate: sqlItem.StandardBurnRate != null ? sqlItem.StandardBurnRate : 12.0,
                        Status: sqlItem.Status || 'Active',
                        CreatedAt: sqlItem.CreatedAt,
                        CreatedBy: sqlItem.CreatedBy,
                        UpdatedAt: sqlItem.UpdatedAt,
                        UpdatedBy: sqlItem.UpdatedBy,
                        isSavedInDb: true,
                    });
                } else {
                    // Vehicle from live transactions not yet customized in Azure SQL
                    mergedList.push({
                        Asset: assetKey,
                        FleetId: v.fleetId || '-',
                        Department: v.dept || selectedClient?.name || 'Operations',
                        VehicleYear: '-',
                        Make: '-',
                        Model: '-',
                        VehicleClass: 'Light Vehicle',
                        ModeOfUse: 'Operational',
                        MonthlyMileageAllowanceKm: '-',
                        BurnRateLPer100Km: calculatedBurnRate,
                        FuelLimitLitres: '-',
                        StandardBurnRate: 12.0,
                        Status: 'Active',
                        isSavedInDb: false,
                    });
                }
            });

            // Also include any custom vehicles in Azure SQL that had no transactions in current range
            dbRecords.forEach((sqlItem) => {
                const assetKey = (sqlItem.Asset || '').trim().toUpperCase();
                if (assetKey && !seenAssets.has(assetKey)) {
                    seenAssets.add(assetKey);
                    mergedList.push({
                        VehicleId: sqlItem.VehicleId,
                        Asset: sqlItem.Asset,
                        FleetId: sqlItem.FleetId || '-',
                        Department: sqlItem.Department || selectedClient?.name || 'Operations',
                        VehicleYear: sqlItem.VehicleYear ?? '-',
                        Make: sqlItem.Make || '-',
                        Model: sqlItem.Model || '-',
                        VehicleClass: sqlItem.VehicleClass || 'Light Vehicle',
                        ModeOfUse: sqlItem.ModeOfUse || 'Operational',
                        MonthlyMileageAllowanceKm: sqlItem.MonthlyMileageAllowanceKm != null ? sqlItem.MonthlyMileageAllowanceKm : '-',
                        BurnRateLPer100Km: sqlItem.BurnRateLPer100Km != null ? sqlItem.BurnRateLPer100Km : '-',
                        FuelLimitLitres: sqlItem.FuelLimitLitres != null ? sqlItem.FuelLimitLitres : '-',
                        StandardBurnRate: sqlItem.StandardBurnRate != null ? sqlItem.StandardBurnRate : 12.0,
                        Status: sqlItem.Status || 'Active',
                        CreatedAt: sqlItem.CreatedAt,
                        CreatedBy: sqlItem.CreatedBy,
                        UpdatedAt: sqlItem.UpdatedAt,
                        UpdatedBy: sqlItem.UpdatedBy,
                        isSavedInDb: true,
                    });
                }
            });

            // Sort alphabetically by Asset
            mergedList.sort((a, b) => a.Asset.localeCompare(b.Asset));

            setRecords(mergedList);
        } catch (err: any) {
            console.error('Failed to load vehicles:', err);
            setNotification({
                type: 'error',
                message: err.message || 'Error loading vehicle list',
            });
        } finally {
            setLoading(false);
            useClientStore.getState().setClientLoading(false);
        }
    };

    // Calculate dynamic rows to fit viewport
    useEffect(() => {
        if (pageSizeMode !== 'auto') {
            setPageSize(pageSizeMode);
            return;
        }

        const computeRows = () => {
            if (tableContainerRef.current) {
                const containerHeight = tableContainerRef.current.clientHeight;
                const headerHeight = 34;
                const scrollbarHeight = 10;
                const rowHeight = 36;
                const availableForRows = containerHeight - headerHeight - scrollbarHeight;
                if (availableForRows > 0) {
                    const exactFit = Math.max(5, Math.floor(availableForRows / rowHeight));
                    setPageSize(exactFit);
                }
            } else if (typeof window !== 'undefined') {
                const overhead = 280;
                const availableHeight = window.innerHeight - overhead;
                const rowHeight = 36;
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
    }, [pageSizeMode, loading]);

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const handleReset = () => {
        setSearchInput('');
        setSearch('');
        setSelectedDept('');
        setSelectedMake('');
        setSelectedStatus('');
        setPage(1);
    };

    // Open modal to add new vehicle
    const handleOpenAdd = () => {
        setModalMode('add');
        setEditingRecord(null);
        setFormData({
            Asset: '',
            FleetId: '',
            Department: selectedClient?.name || 'Operations',
            VehicleYear: new Date().getFullYear(),
            Make: '',
            Model: '',
            VehicleClass: 'Light Vehicle',
            ModeOfUse: 'Operational',
            MonthlyMileageAllowanceKm: 3000,
            BurnRateLPer100Km: 12.5,
            FuelLimitLitres: 300,
            StandardBurnRate: 12.0,
            Status: 'Active',
            CreatedBy: 'Admin',
        });
        setIsModalOpen(true);
    };

    // Open modal to edit existing vehicle
    const handleOpenEdit = (rec: VehicleDetailRecord) => {
        setModalMode('edit');
        setEditingRecord(rec);
        setFormData({
            ...rec,
            FleetId: rec.FleetId === '-' ? '' : rec.FleetId,
            Department: rec.Department === '-' ? '' : rec.Department,
            VehicleYear: rec.VehicleYear === '-' ? '' : rec.VehicleYear,
            Make: rec.Make === '-' ? '' : rec.Make,
            Model: rec.Model === '-' ? '' : rec.Model,
            VehicleClass: rec.VehicleClass === '-' ? '' : rec.VehicleClass,
            ModeOfUse: rec.ModeOfUse === '-' ? '' : rec.ModeOfUse,
            MonthlyMileageAllowanceKm: rec.MonthlyMileageAllowanceKm === '-' ? '' : rec.MonthlyMileageAllowanceKm,
            BurnRateLPer100Km: rec.BurnRateLPer100Km === '-' ? '' : rec.BurnRateLPer100Km,
            FuelLimitLitres: rec.FuelLimitLitres === '-' ? '' : rec.FuelLimitLitres,
            StandardBurnRate: rec.StandardBurnRate === '-' ? '' : rec.StandardBurnRate,
            Status: rec.Status || 'Active',
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.Asset?.trim()) {
            setNotification({ type: 'error', message: 'Asset (Registration) is required.' });
            return;
        }

        try {
            setActionLoading(true);

            const payload = {
                VehicleId: editingRecord?.VehicleId,
                Asset: formData.Asset.trim().toUpperCase(),
                FleetId: formData.FleetId ? formData.FleetId.trim().toUpperCase() : null,
                Department: formData.Department?.trim() || null,
                VehicleYear: formData.VehicleYear && formData.VehicleYear !== '-' ? parseInt(formData.VehicleYear.toString(), 10) : null,
                Make: formData.Make && formData.Make !== '-' ? formData.Make.trim().toUpperCase() : null,
                Model: formData.Model && formData.Model !== '-' ? formData.Model.trim().toUpperCase() : null,
                VehicleClass: formData.VehicleClass && formData.VehicleClass !== '-' ? formData.VehicleClass.trim() : null,
                ModeOfUse: formData.ModeOfUse && formData.ModeOfUse !== '-' ? formData.ModeOfUse.trim() : null,
                MonthlyMileageAllowanceKm: formData.MonthlyMileageAllowanceKm !== '' && formData.MonthlyMileageAllowanceKm !== '-' && formData.MonthlyMileageAllowanceKm != null
                    ? parseFloat(formData.MonthlyMileageAllowanceKm.toString())
                    : null,
                BurnRateLPer100Km: formData.BurnRateLPer100Km !== '' && formData.BurnRateLPer100Km !== '-' && formData.BurnRateLPer100Km != null
                    ? parseFloat(formData.BurnRateLPer100Km.toString())
                    : null,
                FuelLimitLitres: formData.FuelLimitLitres !== '' && formData.FuelLimitLitres !== '-' && formData.FuelLimitLitres != null
                    ? parseFloat(formData.FuelLimitLitres.toString())
                    : null,
                StandardBurnRate: formData.StandardBurnRate !== '' && formData.StandardBurnRate !== '-' && formData.StandardBurnRate != null
                    ? parseFloat(formData.StandardBurnRate.toString())
                    : null,
                Status: formData.Status || 'Active',
                CreatedBy: 'Admin',
                UpdatedBy: 'Admin',
            };

            // If it already has VehicleId, do PUT (update). If not (brand new or from live transactions), do POST (insert).
            if (editingRecord?.VehicleId) {
                const res = await fetch('/api/vehicles', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || 'Failed to update vehicle');
                }
                setNotification({
                    type: 'success',
                    message: `Vehicle "${payload.Asset}" updated in Azure SQL Database!`,
                });
            } else {
                const res = await fetch('/api/vehicles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || 'Failed to add vehicle');
                }
                setNotification({
                    type: 'success',
                    message: `Vehicle "${payload.Asset}" saved to Azure SQL Database!`,
                });
            }

            setIsModalOpen(false);
            loadAllVehicles();
        } catch (err: any) {
            console.error('Save failed:', err);
            setNotification({
                type: 'error',
                message: err.message || 'Failed to save vehicle details',
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteClick = (rec: VehicleDetailRecord) => {
        setDeleteConfirmRecord(rec);
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmRecord) return;

        try {
            setActionLoading(true);

            if (deleteConfirmRecord.VehicleId) {
                const res = await fetch(`/api/vehicles?id=${deleteConfirmRecord.VehicleId}`, {
                    method: 'DELETE',
                });
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || 'Failed to delete vehicle');
                }
            }

            setNotification({
                type: 'success',
                message: `Vehicle "${deleteConfirmRecord.Asset}" removed.`,
            });
            setDeleteConfirmRecord(null);
            loadAllVehicles();
        } catch (err: any) {
            console.error('Delete failed:', err);
            setNotification({
                type: 'error',
                message: err.message || 'Failed to delete vehicle',
            });
        } finally {
            setActionLoading(false);
        }
    };

    // Filter dropdown lists
    const departments = Array.from(new Set(records.map((r) => r.Department).filter(d => d && d !== '-')));
    const makes = Array.from(new Set(records.map((r) => r.Make).filter(m => m && m !== '-')));

    const filteredData = records.filter((item) => {
        const query = search.toLowerCase();
        const matchesSearch =
            !search ||
            (item.Asset && item.Asset.toLowerCase().includes(query)) ||
            (item.FleetId && item.FleetId.toLowerCase().includes(query)) ||
            (item.Make && item.Make.toLowerCase().includes(query)) ||
            (item.Model && item.Model.toLowerCase().includes(query)) ||
            (item.Department && item.Department.toLowerCase().includes(query));

        const matchesDept = !selectedDept || item.Department === selectedDept;
        const matchesMake = !selectedMake || item.Make === selectedMake;
        const matchesStatus = !selectedStatus || item.Status === selectedStatus;

        return matchesSearch && matchesDept && matchesMake && matchesStatus;
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
                'Department',
                'Year',
                'Make',
                'Model',
                'Class',
                'Mode of Use',
                'Monthly Mileage (KM)',
                'Burn Rate (L/100KM)',
                'Fuel Limit (L)',
                'Standard Burn Rate',
                'Status',
            ];
            const rows = filteredData.map((item) => [
                item.Asset,
                item.FleetId || '-',
                item.Department || '-',
                item.VehicleYear || '-',
                item.Make || '-',
                item.Model || '-',
                item.VehicleClass || '-',
                item.ModeOfUse || '-',
                item.MonthlyMileageAllowanceKm != null && item.MonthlyMileageAllowanceKm !== '-' ? item.MonthlyMileageAllowanceKm : '-',
                item.BurnRateLPer100Km != null && item.BurnRateLPer100Km !== '-' ? item.BurnRateLPer100Km : '-',
                item.FuelLimitLitres != null && item.FuelLimitLitres !== '-' ? item.FuelLimitLitres : '-',
                item.StandardBurnRate != null && item.StandardBurnRate !== '-' ? item.StandardBurnRate : '-',
                item.Status || 'Active',
            ]);

            const clientLabel = selectedClient?.clientid || 'vehicles';

            if (format === 'csv') {
                exportToCSV(`vehicle_details_${clientLabel}.csv`, headers, rows);
            } else if (format === 'excel') {
                exportToExcel(`vehicle_details_${clientLabel}.xlsx`, headers, rows, 'Vehicle Details');
            } else if (format === 'pdf') {
                exportToPDF('Vehicle Details Report', headers, rows);
            }
        } catch (err) {
            console.error('Failed to export vehicle details:', err);
        } finally {
            setIsExporting(null);
            setExportOpen(false);
        }
    };

    if (loading) {
        return (
            <PageContainer>
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                    <LoadingSpinner size="lg" />
                    <p className="text-xs text-slate-500 font-medium">Loading fleet vehicles & Azure SQL records...</p>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer className="p-2 sm:p-3 space-y-0 h-full flex flex-col overflow-hidden relative">
            {/* Notification Banner */}
            {notification && (
                <div
                    className={`mb-2 p-3 rounded-lg flex items-center justify-between text-xs font-semibold shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
                        notification.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {notification.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                        )}
                        <span>{notification.message}</span>
                    </div>
                    <button
                        onClick={() => setNotification(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            <Card className="rounded border border-slate-200 shadow-sm p-2.5 mb-0 flex-1 flex flex-col overflow-hidden bg-white">
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden justify-between">
                    {/* Filter bar container */}
                    <div className="mb-2 py-1.5 px-3 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20 overflow-x-auto overflow-y-visible">
                        <div className="flex items-end justify-between gap-2 min-w-max">
                            {/* Left Filters Group */}
                            <div className="flex items-end gap-2 shrink-0">
                                {/* Total Assets Metric */}
                                <div className="flex flex-col gap-1 shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Total Fleet Vehicles
                                    </label>
                                    <div className="flex items-center px-2.5 border border-slate-200 bg-white rounded h-8 shadow-xs">
                                        <Database className="h-3 w-3 text-[#138024] mr-1.5" />
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

                                {/* Status Filter */}
                                <div className="flex flex-col gap-1 w-[100px] shrink-0">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        Status
                                    </label>
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => {
                                            setSelectedStatus(e.target.value);
                                            setPage(1);
                                        }}
                                        className="w-full h-8 px-2 text-xs border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522]"
                                    >
                                        <option value="">All Status</option>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Right Action Buttons Group */}
                            <div className="flex items-end gap-1.5 shrink-0">
                                {/* Refresh / Sync Button */}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={loadAllVehicles}
                                    className="h-8 px-2.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-1 text-xs font-semibold whitespace-nowrap cursor-pointer"
                                    title="Reload all fleet vehicles"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    <span>Sync</span>
                                </Button>

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

                    {/* Table matching standard theme */}
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
                                        Department
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
                                        Monthly Mileage (KM)
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-right font-semibold sticky top-0 z-10">
                                        Burn Rate (L/100KM)
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-right font-semibold sticky top-0 z-10">
                                        Fuel Limit (L)
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-right font-semibold sticky top-0 z-10">
                                        Standard B/Rate
                                    </th>
                                    <th className="bg-[#137e19] text-white py-2 px-3 text-center font-semibold sticky top-0 z-10">
                                        Status
                                    </th>
                                    <th className="bg-[#222222] text-white py-2 px-3 text-center font-semibold sticky top-0 z-10">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={14} className="p-8 text-center text-slate-400 bg-slate-50">
                                            No vehicle records found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item, idx) => (
                                        <tr
                                            key={item.VehicleId ? `db-${item.VehicleId}` : `live-${item.Asset}-${idx}`}
                                            className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors odd:bg-white even:bg-[#fff9f5]"
                                        >
                                            <td className="py-1.5 px-3 font-bold text-slate-900 align-middle">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{item.Asset}</span>
                                                    {item.isSavedInDb && (
                                                        <span
                                                            title="Saved in Azure SQL Database"
                                                            className="inline-flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200"
                                                        >
                                                            <Database className="h-2.5 w-2.5 mr-0.5" />
                                                            DB
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle font-medium">
                                                {item.FleetId || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.Department || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-center text-slate-600 align-middle">
                                                {item.VehicleYear || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.Make || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.Model || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle">
                                                {item.VehicleClass || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-600 align-middle text-xs">
                                                {item.ModeOfUse || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 align-middle">
                                                {typeof item.MonthlyMileageAllowanceKm === 'number'
                                                    ? formatNumber(item.MonthlyMileageAllowanceKm)
                                                    : item.MonthlyMileageAllowanceKm || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-medium text-[#0070c0] align-middle">
                                                {typeof item.BurnRateLPer100Km === 'number'
                                                    ? formatNumber(item.BurnRateLPer100Km, 2)
                                                    : item.BurnRateLPer100Km || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-bold text-slate-900 align-middle">
                                                {typeof item.FuelLimitLitres === 'number'
                                                    ? `${formatNumber(item.FuelLimitLitres)} L`
                                                    : item.FuelLimitLitres || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-right text-slate-700 font-medium align-middle">
                                                {typeof item.StandardBurnRate === 'number'
                                                    ? formatNumber(item.StandardBurnRate, 2)
                                                    : item.StandardBurnRate || '-'}
                                            </td>
                                            <td className="py-1.5 px-3 text-center align-middle">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        (item.Status || 'Active') === 'Active'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {item.Status || 'Active'}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-3 text-center align-middle">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        type="button"
                                                        onClick={() => handleOpenEdit(item)}
                                                        className="h-7 px-2.5 text-xs text-[#f26522] border-[#f26522]/30 hover:bg-orange-50 hover:text-[#d45316] font-semibold flex items-center gap-1 rounded shadow-2xs cursor-pointer"
                                                        title="Edit Vehicle"
                                                    >
                                                        <Edit2 className="h-3 w-3" />
                                                        <span>Edit</span>
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        type="button"
                                                        onClick={() => handleDeleteClick(item)}
                                                        className="h-7 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-semibold flex items-center gap-1 rounded shadow-2xs cursor-pointer"
                                                        title="Delete Vehicle"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
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
                                    Showing <span className="font-semibold text-slate-800">{paginatedData.length}</span> of <span className="font-semibold text-slate-800">{filteredData.length}</span> fleet vehicles
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

            {/* Modal Popup for Add / Edit Vehicle */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200">
                    <div
                        className="fixed inset-0"
                        onClick={() => !actionLoading && setIsModalOpen(false)}
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
                                        {modalMode === 'add' ? 'Add Vehicle (Azure SQL)' : 'Edit Vehicle (Azure SQL)'}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {modalMode === 'add' ? (
                                            'Save new vehicle directly to dbo.VehicleDetails table'
                                        ) : (
                                            <>Asset: <span className="font-bold text-slate-800">{editingRecord?.Asset}</span> ({editingRecord?.FleetId || 'No Fleet ID'})</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionLoading}
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
                                        placeholder="e.g. TEST-002, BFE131"
                                        value={formData.Asset || ''}
                                        onChange={(e) => setFormData({ ...formData, Asset: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900 font-semibold"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">
                                        Fleet ID
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. FL002, 1161"
                                        value={formData.FleetId || ''}
                                        onChange={(e) => setFormData({ ...formData, FleetId: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900 font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Department</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Operations, Logistics"
                                        value={formData.Department || ''}
                                        onChange={(e) => setFormData({ ...formData, Department: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Year</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 2026"
                                        value={formData.VehicleYear ?? ''}
                                        onChange={(e) => setFormData({ ...formData, VehicleYear: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Make</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Toyota, Ford, Isuzu"
                                        value={formData.Make || ''}
                                        onChange={(e) => setFormData({ ...formData, Make: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Model</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Hilux, Ranger, D-Max"
                                        value={formData.Model || ''}
                                        onChange={(e) => setFormData({ ...formData, Model: e.target.value.toUpperCase() })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Vehicle Class</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Light Vehicle, Commercial, 15 SEAT"
                                        value={formData.VehicleClass || ''}
                                        onChange={(e) => setFormData({ ...formData, VehicleClass: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Mode of Use</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Operational, 24/7, Personal"
                                        value={formData.ModeOfUse || ''}
                                        onChange={(e) => setFormData({ ...formData, ModeOfUse: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Monthly Mileage Allowance (KM)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 3000"
                                        value={formData.MonthlyMileageAllowanceKm ?? ''}
                                        onChange={(e) => setFormData({ ...formData, MonthlyMileageAllowanceKm: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Burn Rate (L/100KM)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 12.5"
                                        value={formData.BurnRateLPer100Km ?? ''}
                                        onChange={(e) => setFormData({ ...formData, BurnRateLPer100Km: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3.5">
                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Fuel Limit (L)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 300"
                                        value={formData.FuelLimitLitres ?? ''}
                                        onChange={(e) => setFormData({ ...formData, FuelLimitLitres: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Standard B/Rate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 12.0"
                                        value={formData.StandardBurnRate ?? ''}
                                        onChange={(e) => setFormData({ ...formData, StandardBurnRate: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-slate-700">Status</label>
                                    <select
                                        value={formData.Status || 'Active'}
                                        onChange={(e) => setFormData({ ...formData, Status: e.target.value })}
                                        className="w-full h-8 px-2.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] bg-white text-slate-900 font-semibold"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={actionLoading}
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-8 px-3.5 text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={actionLoading}
                                    className={`${
                                        modalMode === 'add' ? 'bg-[#137e19] hover:bg-[#0e5c12]' : 'bg-[#f26522] hover:bg-[#d94f12]'
                                    } text-white text-xs font-semibold h-8 px-4 flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50`}
                                >
                                    {actionLoading ? (
                                        <LoadingSpinner size="sm" />
                                    ) : modalMode === 'add' ? (
                                        <Plus className="h-3.5 w-3.5" />
                                    ) : (
                                        <Save className="h-3.5 w-3.5" />
                                    )}
                                    {actionLoading ? 'Saving...' : modalMode === 'add' ? 'Add Vehicle' : 'Save to Azure SQL'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200">
                    <div
                        className="fixed inset-0"
                        onClick={() => !actionLoading && setDeleteConfirmRecord(null)}
                    />
                    <div className="relative w-full max-w-md bg-white shadow-2xl rounded-2xl z-10 border border-slate-200 overflow-hidden flex flex-col p-6 space-y-4">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                                <Trash2 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">
                                    Delete Vehicle
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {deleteConfirmRecord.isSavedInDb
                                        ? 'This will permanently delete the row from Azure SQL Database.'
                                        : 'This will remove the vehicle from the current list.'}
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            Are you sure you want to delete vehicle{' '}
                            <span className="font-bold text-slate-900">{deleteConfirmRecord.Asset}</span> ({deleteConfirmRecord.FleetId || 'No Fleet ID'})?
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={actionLoading}
                                onClick={() => setDeleteConfirmRecord(null)}
                                className="h-8 px-3.5 text-xs font-semibold cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleConfirmDelete}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold h-8 px-4 flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {actionLoading ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
