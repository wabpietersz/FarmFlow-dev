import { z } from 'zod';

const leaveTypes = ['casual', 'earned', 'medical', 'maternity', 'unpaid'] as const;

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
  leaveType: z.enum(leaveTypes).optional(),
  shiftId: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.status === 'on_leave' || data.status === 'half_day') {
      return !!data.leaveType;
    }
    return true;
  },
  { message: 'Leave type is required when status is on_leave or half_day', path: ['leaveType'] },
);

export const bulkAttendanceSchema = z.object({
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  shiftId: z.number().int().positive().optional(),
  records: z
    .array(
      z.object({
        employeeId: z.number().int().positive('Employee is required'),
        status: z.enum(['present', 'absent', 'on_leave', 'half_day']),
        leaveType: z.enum(leaveTypes).optional(),
        notes: z.string().max(1000).optional(),
      }).refine(
        (data) => {
          if (data.status === 'on_leave' || data.status === 'half_day') {
            return !!data.leaveType;
          }
          return true;
        },
        { message: 'Leave type is required when status is on_leave or half_day', path: ['leaveType'] },
      ),
    )
    .min(1, 'At least one record is required'),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(['present', 'absent', 'on_leave', 'half_day']).optional(),
  leaveType: z.enum(leaveTypes).nullable().optional(),
  shiftId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).refine(
  (data) => {
    if (data.status === 'on_leave' || data.status === 'half_day') {
      return !!data.leaveType;
    }
    return true;
  },
  { message: 'Leave type is required when status is on_leave or half_day', path: ['leaveType'] },
);

// Leave balance validators
export const setLeaveBalanceSchema = z.object({
  employeeId: z.number().int().positive('Employee is required'),
  leaveType: z.enum(leaveTypes),
  year: z.number().int().min(2020).max(2100),
  totalDays: z.number().min(0, 'Total days must be non-negative'),
});

export const updateLeaveBalanceSchema = z.object({
  totalDays: z.number().min(0).optional(),
  usedDays: z.number().min(0).optional(),
});

export const bulkSetLeaveBalanceSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  balances: z.array(
    z.object({
      employeeId: z.number().int().positive('Employee is required'),
      leaveType: z.enum(leaveTypes),
      totalDays: z.number().min(0, 'Total days must be non-negative'),
    }),
  ).min(1, 'At least one balance entry is required'),
});
