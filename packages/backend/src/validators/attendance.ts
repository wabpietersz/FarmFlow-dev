import { z } from 'zod';

// Shift validators
export const createShiftSchema = z.object({
  shiftName: z.string().min(1, 'Shift name is required').max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:mm)'),
});

export const updateShiftSchema = z.object({
  shiftName: z.string().min(1).max(100).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

// Attendance validators
export const createAttendanceSchema = z.object({
  employeeId: z.number().int().positive('Employee is required'),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  status: z.enum(['present', 'absent', 'on_leave', 'half_day']),
  shiftId: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
});

export const bulkAttendanceSchema = z.object({
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  shiftId: z.number().int().positive().optional(),
  records: z
    .array(
      z.object({
        employeeId: z.number().int().positive('Employee is required'),
        status: z.enum(['present', 'absent', 'on_leave', 'half_day']),
        notes: z.string().max(1000).optional(),
      }),
    )
    .min(1, 'At least one record is required'),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'on_leave', 'half_day']).optional(),
  shiftId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// Leave balance validators
export const setLeaveBalanceSchema = z.object({
  employeeId: z.number().int().positive('Employee is required'),
  leaveType: z.enum(['casual', 'earned', 'medical', 'maternity', 'unpaid']),
  year: z.number().int().min(2020).max(2100),
  totalDays: z.number().int().min(0, 'Total days must be non-negative'),
});

export const updateLeaveBalanceSchema = z.object({
  totalDays: z.number().int().min(0).optional(),
  usedDays: z.number().int().min(0).optional(),
});
