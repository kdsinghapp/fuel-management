// src/app/(dashboard)/admin/clients/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Fuel,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Save,
  X,
  Gauge,
  Clock,
  MapPin,
  Percent,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageContainer } from '@/components/layout/PageContainer';
import { clientService, ClientSettingItem } from '@/services/clientService';
import { useClientStore } from '@/services/api';
import { authService } from '@/lib/auth';
import { formatNumber } from '@/lib/utils';

export default function ClientSettingsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal / Drawer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientSettingItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    clientid: '',
    name: '',
    userid: 2094,
    divisionid: 845,
    tank_capacity: 10000,
    min_stock: 5000,
    depot: '',
    lead_time_days: 2,
    is_active: true,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      loadClients();
    };
    checkAuth();
  }, [router]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientService.getClients();
      setClients(data);
      useClientStore.getState().fetchClients();
    } catch (err: any) {
      console.error('Error loading client settings:', err);
      setError(err.message || 'Failed to load client settings');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (client: ClientSettingItem) => {
    setEditingClient(client);
    setFormData({
      clientid: client.clientid,
      name: client.name,
      userid: client.userid,
      divisionid: client.divisionid,
      tank_capacity: client.tank_capacity,
      min_stock: client.min_stock,
      depot: client.depot || '',
      lead_time_days: client.lead_time_days || 2,
      is_active: client.is_active,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormData({
      clientid: '',
      name: '',
      userid: 2094,
      divisionid: 845,
      tank_capacity: 10000,
      min_stock: 5000,
      depot: '',
      lead_time_days: 2,
      is_active: true,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.clientid.trim()) {
      setModalError('Client ID and Name are required');
      return;
    }

    if (formData.tank_capacity <= 0) {
      setModalError('Tank Capacity must be greater than 0');
      return;
    }

    if (formData.min_stock < 0) {
      setModalError('Critical Level (Min Stock) cannot be negative');
      return;
    }

    try {
      setIsSaving(true);
      setModalError(null);

      if (editingClient) {
        // Update existing
        const updated = await clientService.updateClient(editingClient.clientid, {
          name: formData.name,
          userid: Number(formData.userid),
          divisionid: Number(formData.divisionid),
          tank_capacity: Number(formData.tank_capacity),
          min_stock: Number(formData.min_stock),
          depot: formData.depot.trim() || null,
          lead_time_days: Number(formData.lead_time_days),
          is_active: formData.is_active,
        });

        // Update local list
        setClients((prev) =>
          prev.map((c) => (c.clientid === editingClient.clientid ? updated : c))
        );

        // Update store
        useClientStore.getState().updateClientConfig(editingClient.clientid, {
          name: updated.name,
          tank_capacity: updated.tank_capacity,
          min_stock: updated.min_stock,
          minStock: updated.min_stock,
          depot: updated.depot,
          lead_time_days: updated.lead_time_days,
          is_active: updated.is_active,
        });
      } else {
        // Create new
        const created = await clientService.createClient({
          clientid: formData.clientid.trim(),
          name: formData.name.trim(),
          userid: Number(formData.userid),
          divisionid: Number(formData.divisionid),
          tank_capacity: Number(formData.tank_capacity),
          min_stock: Number(formData.min_stock),
          depot: formData.depot.trim() || null,
          lead_time_days: Number(formData.lead_time_days),
          is_active: formData.is_active,
        });

        setClients((prev) => [...prev, created]);
        useClientStore.getState().fetchClients();
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving client settings:', err);
      setModalError(err.message || 'Failed to save client settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (client: ClientSettingItem) => {
    if (!confirm(`Are you sure you want to delete client "${client.name}" (${client.clientid})?`)) {
      return;
    }

    try {
      await clientService.deleteClient(client.clientid);
      setClients((prev) => prev.filter((c) => c.clientid !== client.clientid));
      useClientStore.getState().fetchClients();
    } catch (err: any) {
      alert(`Error deleting client: ${err.message || err}`);
    }
  };


  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.clientid.toLowerCase().includes(search.toLowerCase()) ||
      (c.depot && c.depot.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? c.is_active
        : !c.is_active;

    return matchesSearch && matchesStatus;
  });

  const totalClients = clients.length;
  const totalCapacity = clients.reduce((sum, c) => sum + (c.tank_capacity || 0), 0);
  const activeCount = clients.filter((c) => c.is_active).length;
  const avgThresholdPct =
    clients.length > 0
      ? Math.round(
          (clients.reduce(
            (sum, c) =>
              sum + (c.tank_capacity > 0 ? (c.min_stock / c.tank_capacity) * 100 : 0),
            0
          ) /
            clients.length)
        )
      : 0;

  const thresholdPercent =
    formData.tank_capacity > 0
      ? Math.round((formData.min_stock / formData.tank_capacity) * 100)
      : 0;

  if (loading && clients.length === 0) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="p-2 sm:p-3 space-y-0 h-full flex flex-col overflow-hidden">
      <Card className="rounded border border-slate-200 shadow-sm p-2.5 mb-0 flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden justify-between">
          {/* Header & KPI Summary Banner */}
          <div className="mb-2 py-2 px-3 bg-[#eefcf2] border border-[#d6f2e1] rounded w-full shrink-0 relative z-20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left Title & KPI Cards */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-[#138024] text-white">
                      <Fuel className="h-4 w-4" />
                    </span>
                    <h1 className="text-sm font-bold text-slate-800">
                      Client & Tank Configuration
                    </h1>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Configure storage tank capacities, critical thresholds & reorder parameters
                  </p>
                </div>

                <div className="h-7 w-[1px] bg-emerald-200 hidden sm:block" />

                {/* Total Clients Stat */}
                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Clients:</span>
                  <span className="text-xs font-bold text-slate-800">{totalClients}</span>
                </div>

                {/* Combined Capacity Stat */}
                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Total Capacity:</span>
                  <span className="text-xs font-bold text-[#138024]">
                    {formatNumber(totalCapacity, 0)} L
                  </span>
                </div>

                {/* Avg Critical Level % */}
                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Avg Critical Level:</span>
                  <span className="text-xs font-bold text-[#f26522]">{avgThresholdPct}%</span>
                </div>

                {/* Active Stat */}
                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Active:</span>
                  <span className="text-xs font-bold text-emerald-700">
                    {activeCount} / {totalClients}
                  </span>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={loadClients}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
                  title="Reload Client Settings"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
                <Button
                  onClick={handleOpenCreate}
                  className="bg-[#f26522] hover:bg-[#d94f12] text-xs font-semibold text-white px-3.5 rounded h-8 border border-[#f26522] transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Client Site
                </Button>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search Box */}
              <div className="flex h-8 w-[240px]">
                <span className="flex items-center px-2.5 border border-r-0 border-slate-200 bg-slate-50 rounded-l text-slate-400">
                  <Search className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Search client name, ID, depot..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#f26522] focus:border-[#f26522] h-8 rounded-r rounded-l-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({clients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    statusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    statusFilter === 'inactive'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Inactive ({totalClients - activeCount})
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Showing <span className="font-bold text-slate-700">{filteredClients.length}</span> of{' '}
              <span className="font-bold text-slate-700">{clients.length}</span> sites
            </div>
          </div>

          {/* Client Table */}
          <div className="overflow-x-auto overflow-y-auto border border-slate-200 shadow-xs rounded mb-1 flex-1 min-h-0">
            <table className="w-full text-sm border-collapse whitespace-nowrap">
              <thead className="sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="bg-[#f26522] text-white py-2 px-3 text-center font-semibold sticky top-0 z-10 w-[90px]">
                    Action
                  </th>
                  <th className="bg-[#f26522] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Client Name
                  </th>
                  <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Client ID
                  </th>
                  <th className="bg-[#0070c0] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Tank Capacity (L)
                  </th>
                  <th className="bg-[#0070c0] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Critical Level / Min Stock (L)
                  </th>
                  <th className="bg-[#0070c0] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Threshold %
                  </th>
                  <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Lead Time
                  </th>
                  <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Depot / Location
                  </th>
                  <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Div / User ID
                  </th>
                  <th className="bg-[#137e19] text-white py-2 px-3 text-left font-semibold sticky top-0 z-10">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 bg-slate-50">
                      No client sites found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const criticalPct =
                      client.tank_capacity > 0
                        ? Math.round((client.min_stock / client.tank_capacity) * 100)
                        : 0;

                    return (
                      <tr
                        key={client.clientid}
                        onClick={() => handleOpenEdit(client)}
                        className="border-b border-slate-200 last:border-0 hover:bg-orange-50/50 transition-colors odd:bg-white even:bg-[#fff9f5] cursor-pointer group"
                      >
                        {/* Action - Edit button upfront */}
                        <td className="py-2 px-2.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenEdit(client)}
                              className="h-7 px-2.5 text-xs font-bold bg-[#f26522] hover:bg-[#d94f12] text-white shadow-xs rounded flex items-center gap-1 cursor-pointer"
                              title="Click to edit tank capacity & critical level"
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(client)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete Client"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>

                        {/* Name */}
                        <td className="py-2 px-3 font-bold text-slate-900 align-middle">
                          <div className="flex items-center gap-2 group-hover:text-[#f26522] transition-colors">
                            <span className="h-2 w-2 rounded-full bg-[#f26522]" />
                            {client.name}
                          </div>
                        </td>

                        {/* Client ID */}
                        <td className="py-2 px-3 font-semibold text-slate-700 align-middle">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs border border-slate-200">
                            {client.clientid}
                          </span>
                        </td>

                        {/* Tank Capacity */}
                        <td className="py-2 px-3 font-bold text-slate-900 align-middle">
                          <div className="flex items-center gap-1.5">
                            <Gauge className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-blue-700">
                              {formatNumber(client.tank_capacity, 0)} L
                            </span>
                          </div>
                        </td>

                        {/* Min Stock / Critical Level */}
                        <td className="py-2 px-3 font-bold align-middle">
                          <span className="text-[#f26522]">
                            {formatNumber(client.min_stock, 0)} L
                          </span>
                        </td>

                        {/* Threshold % */}
                        <td className="py-2 px-3 align-middle">
                          <div className="flex items-center gap-2">
                            <div className="w-14 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  criticalPct <= 25
                                    ? 'bg-emerald-500'
                                    : criticalPct <= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(criticalPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700">
                              {criticalPct}%
                            </span>
                          </div>
                        </td>

                        {/* Lead Time */}
                        <td className="py-2 px-3 text-slate-700 align-middle font-medium">
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {client.lead_time_days || 2} Days
                          </span>
                        </td>

                        {/* Depot */}
                        <td className="py-2 px-3 text-slate-600 align-middle">
                          {client.depot ? (
                            <span className="inline-flex items-center gap-1 text-slate-700 text-xs">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {client.depot}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Division / User ID */}
                        <td className="py-2 px-3 text-slate-600 font-mono text-xs align-middle">
                          Div: {client.divisionid} · User: {client.userid}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 align-middle">
                          {client.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <XCircle className="h-3 w-3 text-slate-400" />
                              Inactive
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-2 px-2 text-xs text-slate-500 border-t border-slate-100 flex items-center justify-between">
            <span className="italic">
              * Critical Level & Tank Capacity configurations are synced directly with the Dashboard tank gauges and Reconciliation stock demand plans.
            </span>
            <span className="font-semibold text-slate-700">
              Total {clients.length} Configured Sites
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded bg-[#f26522] text-white">
                  <Fuel className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {editingClient ? `Edit ${editingClient.name}` : 'Add New Client Site'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Configure storage tank capacity, critical trigger point and site settings
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Client ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client ID (FMA Site ID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingClient}
                    value={formData.clientid}
                    onChange={(e) => setFormData({ ...formData, clientid: e.target.value })}
                    placeholder="e.g. 2591"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
                    required
                  />
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Client Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. St Johns Pom"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:outline-none"
                    required
                  />
                </div>

                {/* Division ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Division ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.divisionid}
                    onChange={(e) => setFormData({ ...formData, divisionid: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:outline-none font-mono"
                    required
                  />
                </div>

                {/* User ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    User ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.userid}
                    onChange={(e) => setFormData({ ...formData, userid: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:outline-none font-mono"
                    required
                  />
                </div>

                {/* Tank Capacity (Litres) */}
                <div className="sm:col-span-2 p-3 bg-blue-50/60 border border-blue-100 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-blue-600" />
                      Tank Capacity (Litres) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-semibold text-blue-700">
                      {formatNumber(formData.tank_capacity, 0)} L
                    </span>
                  </div>

                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={formData.tank_capacity}
                    onChange={(e) => setFormData({ ...formData, tank_capacity: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    required
                  />

                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-blue-600 font-semibold">Presets:</span>
                    {[2500, 5000, 10000, 15000, 20000, 30000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData({ ...formData, tank_capacity: preset })}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          formData.tank_capacity === preset
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {formatNumber(preset, 0)} L
                      </button>
                    ))}
                  </div>
                </div>

                {/* Critical Level / Min Stock (Litres) */}
                <div className="sm:col-span-2 p-3 bg-amber-50/60 border border-amber-100 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Critical Level / Min Stock (Litres) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-amber-800">
                      {thresholdPercent}% of Tank
                    </span>
                  </div>

                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 border border-amber-200 rounded bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    required
                  />

                  {/* Visual threshold gauge */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-amber-700 font-semibold">
                      <span>Low Stock Trigger Point</span>
                      <span>{formatNumber(formData.min_stock, 0)} / {formatNumber(formData.tank_capacity, 0)} L</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-[#f26522] rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(thresholdPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Lead Time Days */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.lead_time_days}
                    onChange={(e) => setFormData({ ...formData, lead_time_days: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:outline-none"
                  />
                </div>

                {/* Depot / Region */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Depot / Region Name
                  </label>
                  <input
                    type="text"
                    value={formData.depot}
                    onChange={(e) => setFormData({ ...formData, depot: e.target.value })}
                    placeholder="e.g. POM Depot"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-[#f26522] focus:outline-none"
                  />
                </div>

                {/* Is Active Toggle */}
                <div className="sm:col-span-2 pt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-[#f26522] rounded border-slate-300 focus:ring-[#f26522]"
                  />
                  <label htmlFor="is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Site is Active (Available for selection and reporting)
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#f26522] hover:bg-[#d94f12] text-white text-xs font-semibold h-8 px-4 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
