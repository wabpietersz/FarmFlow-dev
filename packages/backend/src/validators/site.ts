import { z } from 'zod';

export const createSiteSchema = z.object({
  siteName: z.string().min(1, 'Site name is required').max(100),
  location: z.string().min(1, 'Location is required').max(255),
  capacity: z.number().int().positive('Capacity must be a positive number'),
});

export const updateSiteSchema = z.object({
  siteName: z.string().min(1).max(100).optional(),
  location: z.string().min(1).max(255).optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const createCageSchema = z.object({
  siteId: z.number().int().positive('Site is required'),
  cageNumber: z.string().min(1, 'Cage number is required').max(50),
  capacity: z.number().int().positive('Capacity must be a positive number'),
});

export const updateCageSchema = z.object({
  cageNumber: z.string().min(1).max(50).optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(['empty', 'occupied', 'maintenance']).optional(),
});
