// src/services/deliveryService.ts
import { FuelDelivery } from '@/types/fuel';
import { FilterParams, PaginatedResponse } from '@/types/common';
import { useClientStore, fmaApiRequest } from './api';

export const deliveryService = {
  async getDeliveries(params: FilterParams = {}): Promise<PaginatedResponse<FuelDelivery>> {
    const client = useClientStore.getState().selectedClient;
    
    // Compute API date window with a generous buffer so backend datetime comparison / timezone differences never miss deliveries
    const apiDateFrom = (() => {
      if (params.startDate) {
        const d = new Date(params.startDate + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() - 30);
          return d.toISOString().split('T')[0];
        }
      }
      const d = new Date();
      d.setDate(d.getDate() - 365);
      return d.toISOString().split('T')[0];
    })();

    const apiDateTo = (() => {
      if (params.endDate) {
        const d = new Date(params.endDate + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() + 30);
          return d.toISOString().split('T')[0];
        }
      }
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const payload = {
      clientid: Number(client.clientid),
      userid: Number(client.userid),
      divisionid: Number(client.divisionid),
      datefrom: apiDateFrom,
      dateto: apiDateTo,
      tankno: 1
    };

    try {
      const response = await fmaApiRequest<any[]>('/api/fmaweldandeliveries/GetDeliveries', payload);
      
      // Filter out 'Auto Delivery' (Acronym: 'AD') duplicates, keeping only 'Calculated Delivery' (CD)
      const nonAutoDeliveries = response.filter((item: any) => {
        const acronym = (item.Acronym || '').toString().trim().toUpperCase();
        const name = (item.Name || '').toString().trim().toLowerCase();
        return acronym !== 'AD' && name !== 'auto delivery';
      });

      let data = nonAutoDeliveries.map((item: any) => {
        const rawDate = item['Delivery Start'] || item.Date || item.DeliveryDate || item['Delivery Date'] || '';
        const datePart = rawDate ? rawDate.split('T')[0] : '2026-08-14';
        const timePart = rawDate && rawDate.includes('T') ? rawDate.split('T')[1].slice(0, 8) : (item.Time || '00:00:00');
        return {
          id: item.pk.toString(),
          deliveryId: item.pk.toString(),
          date: datePart,
          time: timePart,
          quantity: item['Delivery amount'] || item.Quantity || 0,
          supplier: item.Name || item.Supplier || 'Calculated Delivery',
          name: item.Name || 'Calculated Delivery',
          acronym: item.Acronym || 'CD',
          status: 'Completed',
          createdAt: item['Delivery Start'] || `${datePart}T${timePart}Z`,
          updatedAt: item['Delivery End'] || `${datePart}T${timePart}Z`,
        };
      });

      // Apply search filters if present
      if (params.search) {
        const search = params.search.toLowerCase();
        data = data.filter(item => 
          item.deliveryId.toLowerCase().includes(search) ||
          item.supplier.toLowerCase().includes(search) ||
          (item.name && item.name.toLowerCase().includes(search)) ||
          (item.acronym && item.acronym.toLowerCase().includes(search))
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
