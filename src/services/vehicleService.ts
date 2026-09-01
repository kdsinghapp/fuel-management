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
