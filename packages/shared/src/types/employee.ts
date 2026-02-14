export enum EmploymentType {
  Permanent = 'permanent',
  Contract = 'contract',
  Seasonal = 'seasonal',
}

export enum EmployeeStatus {
  Active = 'active',
  OnLeave = 'on_leave',
  Terminated = 'terminated',
}

export enum PayType {
  Monthly = 'monthly',
  Daily = 'daily',
  Hourly = 'hourly',
}

export enum CompensationComponentType {
  Earning = 'earning',
  Deduction = 'deduction',
}

export enum CompensationCalculationType {
  Fixed = 'fixed',
  Percentage = 'percentage',
}

export interface Employee {
  id: number;
  userId?: number | null;
  firstName: string;
  lastName: string;
  designation: string;
  siteId: number;
  siteName?: string;
  employmentType: EmploymentType;
  joinDate: Date;
  status: EmployeeStatus;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContact {
  id: number;
  employeeId: number;
  contactName: string;
  relationship: string;
  phoneNumber: string;
}

export interface BankDetails {
  id: number;
  employeeId: number;
  accountHolderName: string;
  bankName: string;
  branchCode?: string | null;
  accountNumber: string;
  ifscCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeCompensation {
  id: number;
  employeeId: number;
  payType: PayType;
  baseRate: number;
  overtimeRate: number;
  effectiveFrom: Date;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeCompensationComponent {
  id: number;
  revisionId: number;
  componentType: CompensationComponentType;
  name: string;
  calculationType: CompensationCalculationType;
  value: number;
  isTaxable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeCompensationRevision {
  id: number;
  employeeId: number;
  payType: PayType;
  baseRate: number;
  overtimeRate: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  standardHoursPerDay: number;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  components?: EmployeeCompensationComponent[];
}

export interface EmployeeCompensationProfile {
  employeeId: number;
  currentRevision: EmployeeCompensationRevision | null;
  upcomingRevision: EmployeeCompensationRevision | null;
  metadata: {
    revisionCount: number;
    hasOverlaps: boolean;
    overlappingRevisionIds: number[];
  };
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  designation: string;
  siteId: number;
  employmentType: EmploymentType;
  joinDate: string;
  phone?: string;
  emergencyContacts?: Omit<EmergencyContact, 'id' | 'employeeId'>[];
  bankDetails?: Omit<BankDetails, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>;
}

export interface UpdateEmployeeRequest {
  firstName?: string;
  lastName?: string;
  designation?: string;
  siteId?: number;
  employmentType?: EmploymentType;
  phone?: string;
  status?: EmployeeStatus;
}

export interface UpsertCompensationRequest {
  payType: PayType;
  baseRate: number;
  overtimeRate?: number;
  effectiveFrom: string;
  notes?: string;
}

export interface CompensationComponentInput {
  componentType: CompensationComponentType;
  name: string;
  calculationType: CompensationCalculationType;
  value: number;
  isTaxable?: boolean;
  isActive?: boolean;
}

export interface CreateCompensationRevisionRequest {
  payType: PayType;
  baseRate: number;
  overtimeRate?: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  standardHoursPerDay?: number;
  notes?: string;
  isActive?: boolean;
  components?: CompensationComponentInput[];
}

export interface UpdateCompensationRevisionRequest {
  payType?: PayType;
  baseRate?: number;
  overtimeRate?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  standardHoursPerDay?: number;
  notes?: string | null;
  isActive?: boolean;
  components?: CompensationComponentInput[];
}
