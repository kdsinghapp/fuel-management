import { BaseEntity } from './common';

export interface FuelLevel extends BaseEntity {
  date: string;
  time: string;
  fuelLevel: number;
  percentage: number;
  status: string;
}

export interface FuelIssue extends BaseEntity {
  transactionId: string;
  date: string;
  time: string;
  vehicleId: string;
  fuelQuantity: number;
  assetType: string;
  status: string;
}

export interface FuelDelivery extends BaseEntity {
  deliveryId: string;
  date: string;
  time: string;
  quantity: number;
  supplier: string;
  status: string;
}

export interface TankStatus {
  capacity: number;
  currentLevel: number;
  percentage: number;
  status: string;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  type: 'issue' | 'delivery';
  vehicleId?: string;
  quantity: number;
  status: string;
}
