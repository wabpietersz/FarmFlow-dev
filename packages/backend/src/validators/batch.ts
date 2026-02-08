import { z } from 'zod';

export const createBatchSchema = z.object({
  batchCode: z.string().min(1, 'Batch code is required').max(50),
  siteId: z.number().int().positive('Site is required'),
  cageId: z.number().int().positive('Cage is required'),
  chicksPlaced: z.number().int().positive('Number of chicks must be positive'),
  placementDate: z.string().min(1, 'Placement date is required'),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateBatchSchema = z.object({
  status: z.enum(['placement', 'growing', 'ready_for_sale', 'sold', 'culled']).optional(),
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const createDailyRecordSchema = z.object({
  batchId: z.number().int().positive('Batch is required'),
  recordDate: z.string().min(1, 'Record date is required'),
  currentAge: z.number().int().min(0, 'Age must be non-negative'),
  birdCount: z.number().int().positive('Bird count must be positive'),
  mortalityCount: z.number().int().min(0).default(0),
  mortalityCause: z.string().max(100).optional(),
  waterConsumption: z.number().min(0).optional(),
  feedConsumption: z.number().min(0, 'Feed consumption is required'),
  averageWeight: z.number().min(0).optional(),
  temperature: z.number().optional(),
  humidity: z.number().int().min(0).max(100).optional(),
  ammoniaLevel: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export const createVaccinationSchema = z.object({
  batchId: z.number().int().positive('Batch is required'),
  vaccineType: z.string().min(1, 'Vaccine type is required').max(100),
  vaccinationDate: z.string().min(1, 'Vaccination date is required'),
  notes: z.string().max(1000).optional(),
});
