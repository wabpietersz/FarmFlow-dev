export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  OnLeave = 'on_leave',
  HalfDay = 'half_day',
}

export enum LeaveType {
  Casual = 'casual',
  Earned = 'earned',
  Medical = 'medical',
  Maternity = 'maternity',
  Unpaid = 'unpaid',
}

export enum PayrollStatus {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Approved = 'approved',
  Paid = 'paid',
}

export interface Attendance {
  id: number;
  employeeId: number;
  attendanceDate: Date;
  status: AttendanceStatus;
  shiftId?: number | null;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: Date;
}

export interface Shift {
  id: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveBalance {
  id: number;
  employeeId: number;
  leaveType: LeaveType;
  year: number;
  totalDays: number;
  usedDays: number;
  balanceDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payroll {
  id: number;
  employeeId: number;
  payPeriod: Date;
  baseSalary: number;
  workingDays: number;
  attendedDays: number;
  overtimeHours: number;
  overtimeRate?: number | null;
  grossSalary: number;
  netSalary: number;
  status: PayrollStatus;
  approvedBy?: number | null;
  paidDate?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollDeduction {
  id: number;
  payrollId: number;
  deductionType: string;
  amount: number;
  remarks?: string | null;
}

export interface PayrollAllowance {
  id: number;
  payrollId: number;
  allowanceType: string;
  amount: number;
  remarks?: string | null;
}

// --- Request interfaces ---

export interface CreateShiftRequest {
  shiftName: string;
  startTime: string;
  endTime: string;
}

export interface CreateAttendanceRequest {
  employeeId: number;
  attendanceDate: string;
  status: AttendanceStatus;
  shiftId?: number;
  notes?: string;
}

export interface BulkAttendanceRequest {
  attendanceDate: string;
  shiftId?: number;
  records: Array<{
    employeeId: number;
    status: AttendanceStatus;
    notes?: string;
  }>;
}

export interface SetLeaveBalanceRequest {
  employeeId: number;
  leaveType: LeaveType;
  year: number;
  totalDays: number;
}

export interface CreatePayrollRequest {
  employeeId: number;
  payPeriod: string;
  baseSalary: number;
  workingDays: number;
  overtimeHours?: number;
  overtimeRate?: number;
  notes?: string;
}

export interface GeneratePayrollRequest {
  payPeriod: string;
  workingDays: number;
}

export interface UpdatePayrollStatusRequest {
  status: PayrollStatus;
}

export interface CreateDeductionRequest {
  deductionType: string;
  amount: number;
  remarks?: string;
}

export interface CreateAllowanceRequest {
  allowanceType: string;
  amount: number;
  remarks?: string;
}
