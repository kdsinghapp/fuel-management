// src/services/api.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ClientConfig {
  name: string;
  clientid: string;
  userid: number;
  divisionid: number;
  tank_capacity?: number;
  min_stock?: number;
  minStock?: number;
  depot?: string | null;
  lead_time_days?: number;
  is_active?: boolean;
}

export const DEFAULT_CLIENT: ClientConfig = {
  name: 'St Johns Pom',
  clientid: '2591',
  userid: 2094,
  divisionid: 845,
  minStock: 5000,
  tank_capacity: 10000,
  min_stock: 5000,
  lead_time_days: 2,
  is_active: true,
};

// Dynamic client list fallback
export const CLIENTS: ClientConfig[] = [DEFAULT_CLIENT];

export interface ExtraColumnConfig {
  id: string;
  header: string;
  clientid: string;
  divisionid: number;
  userid: number;
  siteName?: string;
}

export const CLIENT_EXTRA_RECON_COLUMNS: Record<string, ExtraColumnConfig[]> = {
  // Laga Industries Gabaka
  '1967': [
    {
      id: 'genset_issue',
      header: 'Genset Issue',
      clientid: '2049',
      divisionid: 795,
      userid: 2094,
      siteName: 'Laga POM Genset'
    }
  ],
  'Laga Industries Gabaka': [
    {
      id: 'genset_issue',
      header: 'Genset Issue',
      clientid: '2049',
      divisionid: 795,
      userid: 2094,
      siteName: 'Laga POM Genset'
    }
  ],
  // Paradise Foods HQ
  '2004': [
    {
      id: 'pfl_main_genset_t10',
      header: 'PFL Pom Main Genset & T10 Tank',
      clientid: '2046',
      divisionid: 730,
      userid: 2094,
      siteName: 'PFL POM Main Genset & T10 Tank'
    },
    {
      id: 'pfl_choc_factory_t5',
      header: 'PFL Pom Choc Factory T5 Tank + Gen',
      clientid: '2047',
      divisionid: 730,
      userid: 2094,
      siteName: 'PFL POM Chocolate Genset & T5 Tank'
    }
  ],
  'Paradise Foods HQ': [
    {
      id: 'pfl_main_genset_t10',
      header: 'PFL Pom Main Genset & T10 Tank',
      clientid: '2046',
      divisionid: 730,
      userid: 2094,
      siteName: 'PFL POM Main Genset & T10 Tank'
    },
    {
      id: 'pfl_choc_factory_t5',
      header: 'PFL Pom Choc Factory T5 Tank + Gen',
      clientid: '2047',
      divisionid: 730,
      userid: 2094,
      siteName: 'PFL POM Chocolate Genset & T5 Tank'
    }
  ]
};

interface ClientStore {
  selectedClient: ClientConfig;
  clientsList: ClientConfig[];
  isClientLoading: boolean;
  selectClient: (client: ClientConfig) => void;
  setClientLoading: (loading: boolean) => void;
  fetchClients: () => Promise<void>;
  updateClientConfig: (clientid: string, updates: Partial<ClientConfig>) => void;
}

export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      selectedClient: DEFAULT_CLIENT,
      clientsList: [],
      isClientLoading: false,
      selectClient: (client) => {
        set({ selectedClient: client, isClientLoading: true });
        // Fallback safety timeout in case network stalls
        setTimeout(() => {
          set((state) => (state.isClientLoading ? { isClientLoading: false } : {}));
        }, 10000);
      },
      setClientLoading: (loading) => set({ isClientLoading: loading }),
      fetchClients: async () => {
        try {
          const res = await fetch('/api/clients');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.data) && data.data.length > 0) {
              const formattedList: ClientConfig[] = data.data.map((c: any) => ({
                name: c.name,
                clientid: String(c.clientid),
                userid: Number(c.userid),
                divisionid: Number(c.divisionid),
                tank_capacity: Number(c.tank_capacity),
                min_stock: Number(c.min_stock),
                minStock: Number(c.min_stock),
                depot: c.depot,
                lead_time_days: Number(c.lead_time_days),
                is_active: Boolean(c.is_active),
              }));
              set({ clientsList: formattedList });

              // Sync currently selected client attributes if it exists in list
              const cur = get().selectedClient;
              const matched = formattedList.find(c => c.clientid === cur?.clientid);
              if (matched) {
                set({ selectedClient: { ...cur, ...matched } });
              } else if (formattedList.length > 0 && (!cur || !cur.clientid || cur.clientid === DEFAULT_CLIENT.clientid)) {
                set({ selectedClient: formattedList[0] });
              }
            }
          }
        } catch {
          // Ignore network errors on initial offline mode
        }
      },
      updateClientConfig: (clientid, updates) => {
        set((state) => {
          const updatedList = state.clientsList.map((c) =>
            c.clientid === clientid ? { ...c, ...updates, minStock: updates.min_stock ?? updates.minStock ?? c.minStock } : c
          );
          const isSelected = state.selectedClient?.clientid === clientid;
          return {
            clientsList: updatedList,
            selectedClient: isSelected
              ? { ...state.selectedClient, ...updates, minStock: updates.min_stock ?? updates.minStock ?? state.selectedClient.minStock }
              : state.selectedClient,
          };
        });
      },
    }),
    {
      name: 'client-settings-storage',
      partialize: (state) => ({ selectedClient: state.selectedClient }),
    }
  )
);

const BASE_URL = process.env.NEXT_PUBLIC_FMA_API_URL
const FMA_USER = process.env.NEXT_PUBLIC_FMA_USERNAME 
const FMA_PASS = process.env.NEXT_PUBLIC_FMA_PASSWORD 

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

async function getAuthToken(): Promise<string> {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await fetch(`${BASE_URL}/api/Users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: FMA_USER,
      password: FMA_PASS,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with FMA API');
  }

  const data = await response.json();
  cachedToken = data.token;
  // Set expiry (default 1 hour for safety, ttl is longer)
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken!;
}

export async function fmaApiRequest<T>(endpoint: string, body: any): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}
