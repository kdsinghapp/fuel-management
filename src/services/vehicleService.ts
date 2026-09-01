// src/services/vehicleService.ts
import { Vehicle, VehicleFuelUsage } from '@/types/vehicle';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { fuelIssueService } from './fuelIssueService';

export const vehicleService = {
  async getVehicles(params: FilterParams = {}): Promise<PaginatedResponse<Vehicle>> {
    try {
      // Fetch live transactions to aggregate vehicles, forwarding date filters
      const response = await fuelIssueService.getFuelIssues({
        page: 1,
        pageSize: 2000,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      const transactions = response.data;

      // Group by RegistrationNo / vehicleId
      const groups: Record<string, {
        fuelIssued: number;
        maxOdo: number;
        minOdo: number;
        lastDate: string;
      }> = {};

      transactions.forEach((tx: any) => {
        const vehicle = tx.vehicleId || 'Unknown';
        if (!groups[vehicle]) {
          groups[vehicle] = {
            fuelIssued: 0,
            maxOdo: 0,
            minOdo: Infinity,
            lastDate: tx.date
          };
        }

        groups[vehicle].fuelIssued += tx.fuelQuantity || 0;
        
        const odo = Number(tx.odometer);
        if (odo > 0) {
          if (odo > groups[vehicle].maxOdo) groups[vehicle].maxOdo = odo;
          if (odo < groups[vehicle].minOdo) groups[vehicle].minOdo = odo;
        }

        if (new Date(tx.date).getTime() > new Date(groups[vehicle].lastDate).getTime()) {
          groups[vehicle].lastDate = tx.date;
        }
      });

      let data: Vehicle[] = Object.keys(groups).map((vehicle) => {
        const g = groups[vehicle];
        const distance = g.minOdo !== Infinity && g.maxOdo > g.minOdo ? g.maxOdo - g.minOdo : 0;
        const consumption = distance > 0 ? Number(((g.fuelIssued / distance) * 100).toFixed(1)) : 0;

        return {
          id: vehicle,
          vehicleId: vehicle,
          vehicleType: vehicle.toLowerCase().includes('truck') ? 'Truck' : vehicle.toLowerCase().includes('bus') ? 'Bus' : 'Car',
          assetType: vehicle.toLowerCase().includes('truck') || vehicle.toLowerCase().includes('bus') ? 'Heavy' : 'Light',
          odometer: g.maxOdo > 0 ? g.maxOdo : 0,
          distanceTraveled: distance,
          fuelIssued: Number(g.fuelIssued.toFixed(2)),
          fuelConsumption: consumption,
          status: 'Active',
          createdAt: `${g.lastDate}T00:00:00Z`,
          updatedAt: `${g.lastDate}T00:00:00Z`,
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

      // Sort by vehicleId
      data.sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));

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
