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
  leaveType?: LeaveType | null;
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
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  treasuryTransactionId?: number | null;
  paymentMethod?: 'cash' | 'cheque' | 'bank_transfer' | null;
  chequeLeafId?: number | null;
  chequeNumber?: string | null;
  compensationRevisionId?: number | null;
  compensationSnapshot?: PayrollCompensationSnapshot | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollCompensationSnapshotComponent {
  id: number;
  componentType: 'earning' | 'deduction';
  name: string;
  calculationType: 'fixed' | 'percentage';
  value: number;
  calculatedAmount: number;
  isTaxable: boolean;
}

export interface PayrollCompensationSnapshot {
  revisionId: number;
  payType: 'monthly' | 'daily' | 'hourly';
  baseRate: number;
  overtimeRate: number;
  standardHoursPerDay: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  payPeriodStart: string;
  payPeriodEnd: string;
  components: PayrollCompensationSnapshotComponent[];
}

export type PayrollWarningCode =
  | 'MISSING_COMPENSATION'
  | 'OVERLAPPING_REVISIONS'
  | 'NEGATIVE_BASE_RATE'
  | 'OUTLIER_OVERTIME_RATE'
  | 'INVALID_COMPONENT_CONFIG'
  | 'PAYROLL_ALREADY_EXISTS';

export interface PayrollGenerationWarning {
  employeeId: number;
  employeeName: string;
  code: PayrollWarningCode;
  message: string;
  severity: 'warning' | 'error';
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

export interface CompensationTemplate {
  id: number;
  name: string;
  category: 'allowance' | 'deduction';
  defaultAmount?: number | null;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  leaveType?: LeaveType;
  shiftId?: number;
  notes?: string;
}

export interface BulkAttendanceRequest {
  attendanceDate: string;
  shiftId?: number;
  records: Array<{
    employeeId: number;
    status: AttendanceStatus;
    leaveType?: LeaveType;
    notes?: string;
  }>;
}

export interface SetLeaveBalanceRequest {
  employeeId: number;
  leaveType: LeaveType;
  year: number;
  totalDays: number;
}

export interface BulkSetLeaveBalanceRequest {
  year: number;
  balances: Array<{
    employeeId: number;
    leaveType: LeaveType;
    totalDays: number;
  }>;
}

export interface CreatePayrollRequest {
  employeeId: number;
  payPeriod: string;
  baseSalary: number;
  workingDays: number;
  attendedDays?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  notes?: string;
  allowances?: PayrollAllowanceInput[];
  deductions?: PayrollDeductionInput[];
  compensationRevisionId?: number | null;
}

export interface PayrollAllowanceInput {
  allowanceType: string;
  amount: number;
  remarks?: string;
  included?: boolean;
}

export interface PayrollDeductionInput {
  deductionType: string;
  amount: number;
  remarks?: string;
  included?: boolean;
}

export interface PayrollGenerateEntry {
  employeeId: number;
  baseSalary: number;
  workingDays: number;
  attendedDays?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  notes?: string;
  allowances?: PayrollAllowanceInput[];
  deductions?: PayrollDeductionInput[];
  compensationRevisionId?: number | null;
}

export interface GeneratePayrollRequest {
  payPeriod: string;
  workingDays?: number;
  entries?: PayrollGenerateEntry[];
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

export interface CreateCompensationTemplateRequest {
  name: string;
  category: 'allowance' | 'deduction';
  defaultAmount?: number;
  description?: string;
  isActive?: boolean;
}

export interface UpdateCompensationTemplateRequest {
  name?: string;
  category?: 'allowance' | 'deduction';
  defaultAmount?: number | null;
  description?: string | null;
  isActive?: boolean;
}
