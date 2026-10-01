import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { CostCentre, FinanceCategory, MoneyLedgerResponse } from '@farmflow/shared';

function buildQueryString(params: Record<string, unknown>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '' && value !== null)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

export function useFinanceCategories(params: { status?: 'active' | 'inactive' } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['finance', 'categories', params],
    queryFn: () => apiGet<FinanceCategory[]>(`/treasury/categories${queryString ? `?${queryString}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCostCentres(params: { status?: 'active' | 'inactive' } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['finance', 'cost-centres', params],
    queryFn: () => apiGet<CostCentre[]>(`/treasury/cost-centres${queryString ? `?${queryString}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface CreateFinanceCategoryPayload {
  code: string;
  name: string;
  categoryType: 'income' | 'expense' | 'financing';
  reportGroup: string;
  description?: string;
}

export function useCreateFinanceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFinanceCategoryPayload) => apiPost<FinanceCategory>('/treasury/categories', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'categories'] }),
  });
}

export function useUpdateFinanceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<FinanceCategory, 'name' | 'reportGroup' | 'description' | 'status'>> }) =>
      apiPut<FinanceCategory>(`/treasury/categories/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'categories'] }),
  });
}

export function useCreateCostCentre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; name: string; centreType: 'mill' | 'admin' }) => apiPost<CostCentre>('/treasury/cost-centres', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'cost-centres'] }),
  });
}

export function useUpdateCostCentre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; status?: 'active' | 'inactive' } }) =>
      apiPut<CostCentre>(`/treasury/cost-centres/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'cost-centres'] }),
  });
}

export interface MoneyLedgerParams {
  accountId?: number;
  categoryId?: number;
  costCentreId?: number;
  batchId?: number;
  categoryType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useMoneyLedger(params: MoneyLedgerParams) {
  const queryString = buildQueryString(params as Record<string, unknown>);
  return useQuery({
    queryKey: ['treasury', 'ledger', params],
    queryFn: () => apiGet<MoneyLedgerResponse>(`/treasury/ledger${queryString ? `?${queryString}` : ''}`),
  });
}

export function useRetagLedgerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: number; data: { categoryId: number; costCentreId?: number | null; batchId?: number | null } }) =>
      apiPut(`/treasury/ledger/${entryId}/tags`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'ledger'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
    },
  });
}

// --- Management reports, payables, owner money & loans (Phase 7) ---

export type MonthlyLine = { categoryCode: string; categoryName: string; reportGroup?: string; byMonth: Record<string, number>; total: number };
export type MonthlyTotal = { byMonth: Record<string, number>; total: number };

export interface ProfitAndLoss {
  from: string;
  to: string;
  months: string[];
  costCentreId: number | null;
  income: MonthlyLine[];
  expenses: MonthlyLine[];
  totalIncome: MonthlyTotal;
  totalExpenses: MonthlyTotal;
  netProfit: MonthlyTotal;
  margin: number | null;
  advancesRecognised: number;
}

export interface PnlByCostCentre {
  columns: Array<{ costCentreId: number; name: string; centreType: string; income: number; expenses: number; net: number }>;
  untagged: { income: number; expenses: number };
  total: { income: number; expenses: number; net: number };
}

export interface CashFlowReport {
  from: string;
  to: string;
  months: string[];
  openingBalance: number;
  operating: { lines: MonthlyLine[] } & MonthlyTotal;
  financing: { lines: MonthlyLine[] } & MonthlyTotal;
  other: { lines: MonthlyLine[] } & MonthlyTotal;
  balances: Record<string, { opening: number; net: number; closing: number }>;
  closingBalance: number;
  netChange: number;
}

type AgeingBuckets = { current: number; days1to30: number; days31to60: number; days61to90: number; over90: number };

export interface PayablesAgeing {
  asOf: string;
  totals: AgeingBuckets;
  totalOwed: number;
  overdue: number;
  suppliers: Array<{
    supplierId: number;
    supplierName: string;
    buckets: AgeingBuckets;
    totalOwed: number;
    unappliedCredit: number;
    oldestDaysOverdue: number;
    awaitingApproval: number;
    invoices: Array<{ invoiceId: number; invoiceCode: string; reference: string; invoiceDate: string; dueDate: string; outstanding: number; daysOverdue: number; status: string; matchStatus: string | null }>;
  }>;
}

export interface SupplierStatement {
  supplier: { id: number; supplierName: string; contactPerson: string | null; phone: string | null };
  from: string;
  to: string;
  openingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  entries: Array<{ id: string; entryType: 'invoice' | 'payment'; entryDate: string; referenceCode: string; description: string; charged: number; paid: number; runningBalance: number; status: string }>;
}

export interface BusinessLoan {
  id: number;
  loanCode: string;
  lender: string;
  principal: number;
  interestRate: number | null;
  receivedDate: string;
  termMonths: number | null;
  monthlyInstallment: number | null;
  status: 'active' | 'repaid';
  notes: string | null;
  principalRepaid: number;
  interestPaid: number;
  outstanding: number;
  lastPayment: string | null;
  suggestedInterest: number;
}

const qs = (params: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();

export function useProfitAndLoss(params: { from: string; to: string; costCentreId?: number | null }) {
  return useQuery({ queryKey: ['finance', 'pnl', params], queryFn: () => apiGet<ProfitAndLoss>(`/finance/pnl?${qs(params)}`) });
}

export function usePnlByCostCentre(params: { from: string; to: string }) {
  return useQuery({ queryKey: ['finance', 'pnl-centres', params], queryFn: () => apiGet<PnlByCostCentre>(`/finance/pnl/by-cost-centre?${qs(params)}`) });
}

export function useCashFlow(params: { from: string; to: string; accountId?: number | null }) {
  return useQuery({ queryKey: ['finance', 'cash-flow', params], queryFn: () => apiGet<CashFlowReport>(`/finance/cash-flow?${qs(params)}`) });
}

export function usePayables() {
  return useQuery({ queryKey: ['finance', 'payables'], queryFn: () => apiGet<PayablesAgeing>('/finance/payables') });
}

export function useSupplierStatement(supplierId: number | null, from: string, to: string) {
  return useQuery({
    queryKey: ['finance', 'supplier-statement', supplierId, from, to],
    queryFn: () => apiGet<SupplierStatement>(`/finance/payables/statement/${supplierId}?${qs({ from, to })}`),
    enabled: !!supplierId,
  });
}

export function useBusinessLoans() {
  return useQuery({ queryKey: ['finance', 'loans'], queryFn: () => apiGet<BusinessLoan[]>('/finance/loans') });
}

function useFinanceMutation<T>(fn: (data: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useRecordOwnerMoney = () =>
  useFinanceMutation((data: { direction: 'in' | 'out'; amount: number; date: string; financeAccountId: number; reference?: string | null; notes?: string | null }) => apiPost('/finance/owner-money', data));

export const useReceiveLoan = () =>
  useFinanceMutation((data: { lender: string; principal: number; receivedDate: string; financeAccountId: number; interestRate?: number | null; termMonths?: number | null; monthlyInstallment?: number | null; notes?: string | null }) =>
    apiPost('/finance/loans', data));

export const useRepayLoan = () =>
  useFinanceMutation(({ id, ...data }: { id: number; paymentDate: string; principalAmount: number; interestAmount: number; financeAccountId: number; reference?: string | null }) =>
    apiPost(`/finance/loans/${id}/repayments`, data));
