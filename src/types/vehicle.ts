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
  lastDate: string;
}

export interface FuelEfficiencyTransaction {
  id: string;
  transactionId: string;
  date: string;
  time: string;
  vehicleId: string;
  fleetId: string;
  driverAttendant: string;
  siteId: string;
  depot: string;
  dem: string;
  fuelQuantity: number;
  pump: string;
  odometer: number;
  previousOdo: number | null;
  distance: number | null;
  consumption: number | null;
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

