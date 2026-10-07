// src/services/clientService.ts
export interface ClientSettingItem {
  clientid: string;
  name: string;
  userid: number;
  divisionid: number;
  tank_capacity: number;
  min_stock: number;
  depot?: string | null;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const clientService = {
  async getClients(search?: string, activeOnly?: boolean): Promise<ClientSettingItem[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (activeOnly) params.set('activeOnly', 'true');

    const res = await fetch(`/api/clients?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch clients (${res.status})`);
    }
    const data = await res.json();
    return data.data || [];
  },

  async getClientById(clientid: string): Promise<ClientSettingItem> {
    const res = await fetch(`/api/clients/${encodeURIComponent(clientid)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch client (${res.status})`);
    }
    const data = await res.json();
    return data.data;
  },

  async createClient(client: Partial<ClientSettingItem>): Promise<ClientSettingItem> {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create client (${res.status})`);
    }
    const data = await res.json();
    return data.data;
  },

  async updateClient(
    clientid: string,
    updates: Partial<ClientSettingItem>
  ): Promise<ClientSettingItem> {
    const res = await fetch(`/api/clients/${encodeURIComponent(clientid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update client (${res.status})`);
    }
    const data = await res.json();
    return data.data;
  },

  async deleteClient(clientid: string): Promise<boolean> {
    const res = await fetch(`/api/clients/${encodeURIComponent(clientid)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete client (${res.status})`);
    }
    return true;
  },

  async syncDefaultClients(): Promise<{ success: boolean; data: ClientSettingItem[]; message: string }> {
    const res = await fetch('/api/clients/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to sync clients (${res.status})`);
    }
    return await res.json();
  },
};
