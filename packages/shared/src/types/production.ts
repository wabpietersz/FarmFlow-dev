export enum BatchStatus {
  Placement = 'placement',
  Growing = 'growing',
  ReadyForSale = 'ready_for_sale',
  Sold = 'sold',
  Culled = 'culled',
}

export enum CageStatus {
  Empty = 'empty',
  Occupied = 'occupied',
  Maintenance = 'maintenance',
}

export interface Site {
  id: number;
  siteName: string;
  location: string;
  capacity: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cage {
  id: number;
  siteId: number;
  cageNumber: string;
  capacity: number;
  status: CageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Batch {
  id: number;
  batchCode: string;
  siteId: number;
  cageId: number;
  chicksPlaced: number;
  placementDate: Date;
  expectedDeliveryDate?: Date | null;
  actualDeliveryDate?: Date | null;
  status: BatchStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyRecord {
  id: number;
  batchId: number;
  recordDate: Date;
  currentAge: number;
  birdCount: number;
  mortalityCount: number;
  mortalityCause?: string | null;
  waterConsumption?: number | null;
  feedConsumption: number;
  averageWeight?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  ammoniaLevel?: number | null;
  recordedBy?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vaccination {
  id: number;
  batchId: number;
  vaccineType: string;
  vaccinationDate: Date;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: Date;
}

export interface CreateBatchRequest {
  batchCode: string;
  siteId: number;
  cageId: number;
  chicksPlaced: number;
  placementDate: string;
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface CreateDailyRecordRequest {
  batchId: number;
  recordDate: string;
  currentAge: number;
  birdCount: number;
  mortalityCount?: number;
  mortalityCause?: string;
  waterConsumption?: number;
  feedConsumption: number;
  averageWeight?: number;
  temperature?: number;
  humidity?: number;
  ammoniaLevel?: number;
  notes?: string;
}
