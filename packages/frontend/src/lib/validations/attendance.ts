import { z } from 'zod';

export const shiftFormSchema = z.object({
  shiftName: z.string().min(1, 'Shift name is required').max(100),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
});

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;

export const attendanceFormSchema = z.object({
  employeeId: z.coerce.number().int().positive('Employee is required'),
  attendanceDate: z.string().min(1, 'Date is required'),
  status: z.enum(['present', 'absent', 'on_leave', 'half_day']),
  leaveType: z.enum(['casual', 'earned', 'medical', 'maternity', 'unpaid']).optional(),
  shiftId: z.coerce.number().int().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
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

export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

export const bulkAttendanceFormSchema = z.object({
  attendanceDate: z.string().min(1, 'Date is required'),
  employeeIds: z.array(z.number()).min(1, 'Select at least one employee'),
  status: z.enum(['present', 'absent', 'on_leave', 'half_day']),
  leaveType: z.enum(['casual', 'earned', 'medical', 'maternity', 'unpaid']).optional(),
  shiftId: z.coerce.number().int().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
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

export type BulkAttendanceFormValues = z.infer<typeof bulkAttendanceFormSchema>;

export const leaveBalanceFormSchema = z.object({
  employeeId: z.coerce.number().int().positive('Employee is required'),
  leaveType: z.enum(['casual', 'earned', 'medical', 'maternity', 'unpaid']),
  year: z.coerce.number().int().min(2020).max(2100),
  totalDays: z.coerce.number().min(0, 'Total days must be non-negative'),
});

export type LeaveBalanceFormValues = z.infer<typeof leaveBalanceFormSchema>;

export const bulkLeaveBalanceFormSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  employeeIds: z.array(z.number()).min(1, 'Select at least one employee'),
  leaveType: z.enum(['casual', 'earned', 'medical', 'maternity', 'unpaid']),
  totalDays: z.coerce.number().min(0, 'Total days must be non-negative'),
});

export type BulkLeaveBalanceFormValues = z.infer<typeof bulkLeaveBalanceFormSchema>;
