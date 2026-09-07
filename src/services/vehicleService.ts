// src/services/vehicleService.ts
import { Vehicle, FuelEfficiencyTransaction, VehicleFuelUsage } from '@/types/vehicle';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { fuelIssueService } from './fuelIssueService';

export const vehicleService = {
  async getFuelEfficiencyTransactions(params: FilterParams = {}): Promise<{
    data: FuelEfficiencyTransaction[];
    allTransactions: any[];
  }> {
    try {
      // Fetch live transactions with date filters
      const response = await fuelIssueService.getFuelIssues({
        page: 1,
        pageSize: 100000,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      const rawTransactions = response.data || [];

      // Group all transactions by vehicle registration / fleet id / detail
      const vehicleMap = new Map<string, any[]>();
      rawTransactions.forEach((tx: any) => {
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

        txs.forEach((tx) => {
          const currentOdo = Number(tx.odometer) || 0;
          const litres = Number(tx.fuelQuantity) || 0;

          let distance: number | null = null;
          let consumption: number | null = null;
          let recordedPrevOdo: number | null = null;

          if (prevOdo !== null && prevOdo > 0 && currentOdo > 0 && currentOdo >= prevOdo) {
            distance = currentOdo - prevOdo;
            recordedPrevOdo = prevOdo;
            if (distance > 0 && litres > 0) {
              consumption = Number((distance / litres).toFixed(2));
            }
          } else if (prevOdo !== null && prevOdo > 0) {
            recordedPrevOdo = prevOdo;
          }

          if (currentOdo > 0) {
            prevOdo = currentOdo;
          }

          calculated.push({
            id: tx.id || tx.transactionId || `${tx.date}-${tx.time}-${Math.random()}`,
            transactionId: tx.transactionId || '',
            date: tx.date || '',
            time: tx.time || '',
            vehicleId: tx.vehicleId || '',
            fleetId: tx.fleetId || '',
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

      return {
        data: calculated,
        allTransactions: rawTransactions,
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

