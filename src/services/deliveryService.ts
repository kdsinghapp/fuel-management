// src/services/deliveryService.ts
import { FuelDelivery } from '@/types/fuel';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { useClientStore, fmaApiRequest } from './api';

export const deliveryService = {
  async getDeliveries(params: FilterParams = {}): Promise<PaginatedResponse<FuelDelivery>> {
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
      const response = await fmaApiRequest<any[]>('/api/fmaweldandeliveries/GetDeliveries', payload);
      
      let data = response.map((item: any) => {
        const datePart = item['Delivery Start'] ? item['Delivery Start'].split('T')[0] : '2026-08-14';
        const timePart = item['Delivery Start'] ? item['Delivery Start'].split('T')[1].slice(0, 8) : '00:00:00';
        return {
          id: item.pk.toString(),
          deliveryId: item.pk.toString(),
          date: datePart,
          time: timePart,
          quantity: item['Delivery amount'],
          supplier: item.Name || 'Unknown',
          status: item.Acronym === 'AD' ? 'Completed' : 'Pending',
          createdAt: item['Delivery Start'] || `${datePart}T${timePart}Z`,
          updatedAt: item['Delivery End'] || `${datePart}T${timePart}Z`,
        };
      });

      // Apply search filters if present
      if (params.search) {
        const search = params.search.toLowerCase();
        data = data.filter(item => 
          item.deliveryId.toLowerCase().includes(search) ||
          item.supplier.toLowerCase().includes(search)
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
  
  async getDeliveryById(id: string): Promise<FuelDelivery | null> {
    const res = await this.getDeliveries({ page: 1, pageSize: 100 });
    return res.data.find(d => d.id === id) || null;
  },
};
