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

export interface Employee {
  id: number;
  userId?: number | null;
  firstName: string;
  lastName: string;
  designation: string;
  siteId: number;
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
  employmentType?: EmploymentType;
  phone?: string;
  status?: EmployeeStatus;
}
