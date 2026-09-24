// src/services/vehicleService.ts
import { Vehicle, FuelEfficiencyTransaction, VehicleFuelUsage } from '@/types/vehicle';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { fuelIssueService } from './fuelIssueService';

async function getVehicleMetadataLookup(): Promise<Map<string, { dept: string; standardBRate: number; fuelLimit?: number }>> {
  const map = new Map<string, { dept: string; standardBRate: number; fuelLimit?: number }>();
  
  // 1. Fetch live records from Azure SQL via /api/vehicles
  try {
    const res = await fetch('/api/vehicles');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        json.data.forEach((r: any) => {
          const assetKey = (r.Asset || r.FleetId || '').toString().trim().toUpperCase();
          if (assetKey) {
            const sRate = r.StandardBurnRate != null && !isNaN(Number(r.StandardBurnRate)) && Number(r.StandardBurnRate) > 0
              ? Number(r.StandardBurnRate)
              : (r.BurnRateLPer100Km != null && !isNaN(Number(r.BurnRateLPer100Km)) && Number(r.BurnRateLPer100Km) > 0
                  ? Number(r.BurnRateLPer100Km)
                  : 7.0);

            const entry = {
              dept: r.Department || 'General',
              standardBRate: sRate,
              fuelLimit: r.FuelLimitLitres != null ? Number(r.FuelLimitLitres) : undefined,
            };

            map.set(assetKey, entry);
            if (r.FleetId) {
              map.set(r.FleetId.toString().trim().toUpperCase(), entry);
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch vehicle metadata from Azure SQL API:', err);
  }

  return map;
}

export const vehicleService = {
  async getFuelEfficiencyTransactions(params: FilterParams = {}): Promise<{
    data: FuelEfficiencyTransaction[];
    allTransactions: any[];
  }> {
    try {
      // Compute an extended lookback start date (60 days before requested start)
      // so that we can build a full odometer chain and provide prevOdo context
      // for the first in-range transaction of each vehicle.
      let extendedStartDate: string | undefined = undefined;
      if (params.startDate) {
        const d = new Date(params.startDate + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() - 60);
          extendedStartDate = d.toISOString().split('T')[0];
        }
      }

      // Fetch a wider window so we have odometer context before the period
      const response = await fuelIssueService.getFuelIssues({
        page: 1,
        pageSize: 100000,
        startDate: extendedStartDate || params.startDate,
        endDate: params.endDate,
      });

      const allFetched = response.data || [];
      const metaLookup = await getVehicleMetadataLookup();

      // Determine the in-range boundary for filtering the final results
      const rangeStart = params.startDate ? params.startDate.split('T')[0] : null;
      const rangeEnd = params.endDate ? params.endDate.split('T')[0] : null;

      // Group all fetched transactions (including pre-period context) by vehicle
      const vehicleMap = new Map<string, any[]>();
      allFetched.forEach((tx: any) => {
        const vehicleKey = (tx.vehicleId || tx.fleetId || tx.driverAttendant || 'Unknown').trim().toUpperCase();
        if (!vehicleMap.has(vehicleKey)) {
          vehicleMap.set(vehicleKey, []);
        }
        vehicleMap.get(vehicleKey)!.push(tx);
      });

      const calculated: FuelEfficiencyTransaction[] = [];

      vehicleMap.forEach((txs) => {
        // Sort chronologically ascending within each vehicle
        txs.sort((a, b) => {
          const timeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
          const timeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
          return timeA - timeB;
        });

        let prevOdo: number | null = null;
        let prevOdoIsInRange = false; // tracks if the previous odo came from an in-range tx

        txs.forEach((tx) => {
          const currentOdo = Number(tx.odometer) || 0;
          const litres = Number(tx.fuelQuantity) || 0;
          const txDate = (tx.date || '').split('T')[0];

          // Determine if this transaction is within the user-requested date range
          const isInRange =
            (!rangeStart || txDate >= rangeStart) &&
            (!rangeEnd || txDate <= rangeEnd);

          let distance: number | null = null;
          let consumption: number | null = null;
          let recordedPrevOdo: number | null = null;
          let ltrPer100Km: number | null = null;
          let standardBurnRate: number | null = null;
          let variance: number | null = null;
          let variancePercentage: number | null = null;

          // Only show Previous Odo and calculate Distance if the previous transaction
          // was ALSO within the selected date range.
          // Lookback (out-of-range) transactions seed prevOdo silently but are never
          // shown as "Previous Odo" — prevents nonsensical distances like 241,956 km.
          if (prevOdo !== null && prevOdo > 0 && currentOdo > 0 && prevOdoIsInRange) {
            recordedPrevOdo = prevOdo;
            if (currentOdo >= prevOdo) {
              // Normal case: odometer increased
              distance = currentOdo - prevOdo;
            } else {
              // Odometer decreased — likely a reset or replacement.
              // Use the absolute difference so distance is always shown when
              // both Odo Meter and Previous Odo are present.
              distance = Math.abs(currentOdo - prevOdo);
            }
            if (distance > 0 && litres > 0) {
              consumption = Number((distance / litres).toFixed(2));
              ltrPer100Km = Number(((litres / distance) * 100).toFixed(2));
            }
          }

          if (currentOdo > 0) {
            prevOdo = currentOdo;
            prevOdoIsInRange = isInRange; // remember whether THIS tx was in-range
          }

          // Skip out-of-range context transactions — they were only used to seed prevOdo
          if (!isInRange) return;

          const vehicleLookupKey = (tx.vehicleId || tx.fleetId || '').toString().trim().toUpperCase();
          const fleetLookupKey = (tx.fleetId || '').toString().trim().toUpperCase();
          const meta = metaLookup.get(vehicleLookupKey) || metaLookup.get(fleetLookupKey);

          const department = meta?.dept || tx.depot || tx.department || 'General';

          if (meta?.standardBRate != null && meta.standardBRate > 0) {
            standardBurnRate = Number(meta.standardBRate);
          } else if (consumption != null && consumption > 0) {
            // Default baseline standard burn rate if not set in metadata
            standardBurnRate = 7.0;
          }

          // Variance = Standard Burn Rate - Consumption
          if (standardBurnRate != null && consumption != null) {
            variance = Number((standardBurnRate - consumption).toFixed(2));
            if (standardBurnRate > 0) {
              // Variance % = Variance / Standard Burn Rate
              variancePercentage = Number(((variance / standardBurnRate) * 100).toFixed(1));
            }
          }

          calculated.push({
            id: tx.id || tx.transactionId || `${tx.date}-${tx.time}-${Math.random()}`,
            transactionId: tx.transactionId || '',
            date: tx.date || '',
            time: tx.time || '',
            vehicleId: tx.vehicleId || '',
            fleetId: tx.fleetId || '',
            department: department,
            driverAttendant: tx.driverAttendant || '',
            siteId: tx.siteId || '',
            depot: tx.depot || '',
            dem: tx.dem || '',
            fuelQuantity: litres,
            pump: tx.pump ? String(tx.pump) : '1',
            odometer: currentOdo,
            previousOdo: recordedPrevOdo,
            distance: distance,
            consumption: consumption,
            ltrPer100Km: ltrPer100Km,
            standardBurnRate: standardBurnRate,
            variance: variance,
            variancePercentage: variancePercentage,
            status: tx.status || 'Matched',
          });
        });
      });

      // Sort by Date / Time descending (latest first, matching Transactions)
      calculated.sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time || '00:00:00'}`).getTime();
        const timeB = new Date(`${b.date}T${b.time || '00:00:00'}`).getTime();
        return timeB - timeA;
      });

      // allTransactions: only in-range raw transactions (for DateRangePicker context)
      const inRangeRaw = allFetched.filter((tx: any) => {
        const txDate = (tx.date || '').split('T')[0];
        return (!rangeStart || txDate >= rangeStart) && (!rangeEnd || txDate <= rangeEnd);
      });

      return {
        data: calculated,
        allTransactions: inRangeRaw,
      };
    } catch (err) {
      console.error('Failed to get fuel efficiency transactions:', err);
      return {
        data: [],
        allTransactions: [],
      };
    }
  },

  async getVehicles(params: FilterParams = {}): Promise<PaginatedResponse<Vehicle>> {
    try {
      // Fetch live transactions to aggregate vehicles, forwarding date filters
      const response = await fuelIssueService.getFuelIssues({
        page: 1,
        pageSize: 100000,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      const transactions = response.data;

      // Map each individual transaction as a separate item
      let data: Vehicle[] = transactions.map((tx: any, index: number) => {
        const vehicle = tx.vehicleId && tx.vehicleId.trim() !== '' ? tx.vehicleId : (tx.driverAttendant || 'Unassigned');
        const odo = Number(tx.odometer) || 0;
        const qty = Number(tx.fuelQuantity) || 0;

        return {
          id: `${tx.transactionId || index}`,
          vehicleId: vehicle,
          vehicleType: vehicle.toLowerCase().includes('truck') ? 'Truck' : vehicle.toLowerCase().includes('bus') ? 'Bus' : 'Car',
          assetType: vehicle.toLowerCase().includes('truck') || vehicle.toLowerCase().includes('bus') ? 'Heavy' : 'Light',
          odometer: odo,
          distanceTraveled: 0,
          fuelIssued: Number(qty.toFixed(2)),
          fuelConsumption: 0,
          status: 'Active',
          lastDate: tx.date || '',
          createdAt: `${tx.date}T${tx.time || '00:00:00'}Z`,
          updatedAt: `${tx.date}T${tx.time || '00:00:00'}Z`,
        };
      });

      // Filter by search parameters
      if (params.search) {
        const search = params.search.toLowerCase();
        data = data.filter(item => 
          item.vehicleId.toLowerCase().includes(search) ||
          item.vehicleType.toLowerCase().includes(search) ||
          item.assetType.toLowerCase().includes(search)
        );
      }

      if (params.status) {
        data = data.filter(item => item.status === params.status);
      }

      if (params.vehicleType) {
        data = data.filter(item => item.vehicleType === params.vehicleType);
      }

      // Sort by date descending
      data.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());

      // Pagination
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedData = data.slice(start, end);

      return {
        data: paginatedData,
        total: data.length,
        page,
        pageSize,
        totalPages: Math.ceil(data.length / pageSize),
      };
    } catch (err) {
      console.error(err);
      return {
        data: [],
        total: 0,
        page: params.page || 1,
        pageSize: params.pageSize || 10,
        totalPages: 0,
      };
    }
  },
  
  async getVehicleById(id: string): Promise<Vehicle | null> {
    const res = await this.getVehicles({ page: 1, pageSize: 200 });
    return res.data.find(v => v.id === id) || null;
  },
  
  async getVehicleFuelUsage(vehicleId: string): Promise<VehicleFuelUsage[]> {
    // Generate fuel usage dynamic history
    const usage: VehicleFuelUsage[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      usage.push({
        vehicleId,
        date: date.toISOString().split('T')[0],
        fuelConsumed: Math.floor(Math.random() * 40) + 20,
        distanceTraveled: Math.floor(Math.random() * 200) + 100,
        efficiency: parseFloat((Math.random() * 5 + 5).toFixed(1)),
      });
    }
    
    return usage;
  },
};

