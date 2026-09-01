// src/services/fuelLevelService.ts
import { FuelLevel } from '@/types/fuel';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { useClientStore, fmaApiRequest } from './api';

export const fuelLevelService = {
  async getFuelLevels(params: FilterParams = {}): Promise<PaginatedResponse<FuelLevel>> {
    const client = useClientStore.getState().selectedClient;
    
    // Get start/end dates
    const today = new Date().toISOString().split('T')[0];
    const datefrom = params.startDate;
    const dateto = params.endDate || today;

    // Add 1 day to dateto for the API call to ensure the backend database query includes all items on the end date
    const apiDateTo = (() => {
      const date = new Date(dateto + 'T00:00:00');
      if (isNaN(date.getTime())) return dateto;
      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0];
    })();

    const payload = {
      clientid: Number(client.clientid),
      userid: Number(client.userid),
      divisionid: Number(client.divisionid),
      datefrom,
      dateto: apiDateTo,
      tankno: 1
    };

    try {
      const response = await fmaApiRequest<any[]>('/api/fmatanklevels/GetLevels', payload);
      
      let data = response.map((item: any) => {
        const percentage = Number(((item.Level / 20000) * 100).toFixed(1));
        return {
          id: item.Id.toString(),
          date: item.Date,
          time: item.Time,
          fuelLevel: item.Level,
          percentage: percentage,
          status: percentage < 15 ? 'Low' : 'Normal',
          createdAt: `${item.Date}T${item.Time}Z`,
          updatedAt: `${item.Date}T${item.Time}Z`,
        };
      });

      // Apply search filters if present
      if (params.search) {
        const search = params.search.toLowerCase();
        data = data.filter(item => 
          item.date.includes(search) || 
          item.status.toLowerCase().includes(search)
        );
      }

      // Filter by start and end date locally using timezone-independent YYYY-MM-DD string comparison
      if (params.startDate) {
        const start = params.startDate.split('T')[0].split(' ')[0];
        data = data.filter(item => {
          const itemDate = item.date.split('T')[0].split(' ')[0];
          return itemDate >= start;
        });
      }
      if (params.endDate) {
        const end = params.endDate.split('T')[0].split(' ')[0];
        data = data.filter(item => {
          const itemDate = item.date.split('T')[0].split(' ')[0];
          return itemDate <= end;
        });
      }

      // Sort by date descending
      data.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

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
  
  async getCurrentLevel(): Promise<FuelLevel | null> {
    const res = await this.getFuelLevels({ page: 1, pageSize: 1 });
    return res.data[0] || null;
  },
};
