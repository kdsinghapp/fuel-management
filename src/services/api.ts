// src/services/api.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ClientConfig {
  name: string;
  clientid: string;
  userid: number;
  divisionid: number;
}

export const CLIENTS: ClientConfig[] = [
    { name: 'St Johns Pom', clientid: '2591', userid: 2094, divisionid: 845 },
  { name: 'Digicel POM', clientid: '843', userid: 2094, divisionid: 586 },
  { name: 'Digicel Hagen', clientid: '797', userid: 2094, divisionid: 586 },
  { name: 'PNG Biomass - Zifasing Field Base', clientid: '2042', userid: 2094, divisionid: 653 },
  { name: 'Paradise Foods Hanta', clientid: '2003', userid: 2094, divisionid: 744 },
  { name: 'Paradise Foods HQ', clientid: '2004', userid: 2094, divisionid: 744 },
  { name: 'Laga Industries Taraka', clientid: '2008', userid: 2094, divisionid: 757 },
  { name: 'Laga Industries Gabaka', clientid: '1967', userid: 2094, divisionid: 757 },
  { name: 'TWL Lae', clientid: '2023', userid: 2094, divisionid: 753 },
  { name: 'TWL Hagen', clientid: '2006', userid: 2094, divisionid: 829 },
  { name: 'TWL Pom Transport', clientid: '2394', userid: 2094, divisionid: 816 },
  { name: 'Golden Valley Enterprises', clientid: '2005', userid: 2094, divisionid: 789 },
  { name: 'IPI Lae Bowser', clientid: '2035', userid: 2094, divisionid: 792 },
  { name: 'IPI Hagen Bowser', clientid: '2036', userid: 2094, divisionid: 793 }
];

interface ClientStore {
  selectedClient: ClientConfig;
  isClientLoading: boolean;
  selectClient: (client: ClientConfig) => void;
  setClientLoading: (loading: boolean) => void;
}

export const useClientStore = create<ClientStore>()(
  persist(
    (set) => ({
      selectedClient: CLIENTS[0],
      isClientLoading: false,
      selectClient: (client) => {
        set({ selectedClient: client, isClientLoading: true });
        // Fallback safety timeout in case network stalls
        setTimeout(() => {
          set((state) => (state.isClientLoading ? { isClientLoading: false } : {}));
        }, 10000);
      },
      setClientLoading: (loading) => set({ isClientLoading: loading }),
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
