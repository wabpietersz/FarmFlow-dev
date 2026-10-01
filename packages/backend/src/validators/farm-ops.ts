import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

const healthItemSchema = z.object({
  dayOfAge: z.number().int().min(0).max(120),
  taskType: z.enum(['vaccination', 'medication', 'other']),
  name: z.string().min(1, 'Name is required').max(150),
  method: z.enum(['drinking_water', 'eye_drop', 'spray', 'injection', 'feed', 'other']).nullable().optional(),
  inventoryItemId: z.number().int().positive().nullable().optional(),
  dosePer1000Birds: z.number().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const healthTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  description: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  items: z.array(healthItemSchema).max(60),
});

export const applyHealthTemplateSchema = z.object({
  templateId: z.number().int().positive().nullable(),
});

export const addHealthTaskSchema = z.object({
  dueDate: isoDate,
  taskType: z.enum(['vaccination', 'medication', 'other']),
  name: z.string().min(1).max(150),
  method: healthItemSchema.shape.method,
  inventoryItemId: z.number().int().positive().nullable().optional(),
  plannedQuantity: z.number().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const completeHealthTaskSchema = z.object({
  completedDate: isoDate,
  inventoryItemId: z.number().int().positive().nullable().optional(),
  quantityUsed: z.number().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const skipHealthTaskSchema = z.object({
  reason: z.string().min(1, 'Say why it was skipped').max(500),
});

const growthPointSchema = z.object({
  dayOfAge: z.number().int().min(0).max(120),
  targetWeightG: z.number().int().positive(),
  targetCumFeedG: z.number().int().min(0).nullable().optional(),
  targetCumMortalityPct: z.number().min(0).max(100).nullable().optional(),
});

export const growthStandardSchema = z.object({
  name: z.string().min(1).max(150),
  breed: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  points: z.array(growthPointSchema).min(2, 'Add at least two days').max(120),
});

export const vetVisitSchema = z.object({
  siteId: z.number().int().positive(),
  batchId: z.number().int().positive().nullable().optional(),
  visitDate: isoDate,
  vetName: z.string().min(1, 'Vet name is required').max(150),
  reason: z.string().max(200).nullable().optional(),
  findings: z.string().max(4000).nullable().optional(),
  diagnosis: z.string().max(2000).nullable().optional(),
  treatment: z.string().max(2000).nullable().optional(),
  feeAmount: z.number().min(0).nullable().optional(),
  followUpDate: isoDate.nullable().optional(),
});

export const turnaroundUpdateSchema = z.object({
  litterRemovedDate: isoDate.nullable().optional(),
  cleanedDate: isoDate.nullable().optional(),
  disinfectedDate: isoDate.nullable().optional(),
  newLitterDate: isoDate.nullable().optional(),
  readyDate: isoDate.nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const todayCheckSchema = z.object({
  date: isoDate,
  mortalityCount: z.number().int().min(0),
  mortalityCause: z.string().max(100).nullable().optional(),
  feedConsumption: z.number().min(0),
  waterConsumption: z.number().min(0).nullable().optional(),
  averageWeight: z.number().min(0).max(10000).nullable().optional(),
  temperature: z.number().min(-10).max(60).nullable().optional(),
  humidity: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
