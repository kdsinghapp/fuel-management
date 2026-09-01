import { BaseEntity } from './common';

export interface Vehicle extends BaseEntity {
  vehicleId: string;
  vehicleType: string;
  assetType: string;
  odometer: number;
  distanceTraveled: number;
  fuelIssued: number;
  fuelConsumption: number;
  status: string;
}

export interface VehicleFuelUsage {
  vehicleId: string;
  date: string;
  fuelConsumed: number;
  distanceTraveled: number;
  efficiency: number;
}

export interface DashboardVehicleUsage {
  name: string;
  fuelUsed: number;
}
