import { useSearchParams } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import {
  ArrowRightLeft,
  Building2,
  CircleAlert,
  HandCoins,
  Landmark,
  Plus,
  Wallet,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage, parseApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  useCreateManualTreasuryTransaction,
  useCreateChequeBook,
  useCreatePettyCashAllocation,
  useCreatePettyCashExpense,
  useCreateTreasuryAccount,
  useChequeBooks,
  useChequeLeaves,
  useChequeOverview,
  usePettyCashAllocation,
  usePettyCashAllocations,
  useReviewPettyCashExpense,
  useTreasuryAccounts,
  useTreasuryManagers,
  useTreasuryTransaction,
  useTreasuryTransactions,
  useUpdateChequeLeafStatus,
} from '@/hooks/useTreasury';
import { useUpdatePayment } from '@/hooks/useSales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EMPTY_FINANCE_TAGS, FinanceTagFields, financeTagsToPayload, type FinanceTagValue } from '@/components/finance/FinanceTagFields';
import { MoneyLedgerTab } from '@/components/finance/MoneyLedgerTab';
import { FinanceSetupTab } from '@/components/finance/FinanceSetupTab';
import { ProfitLossTab } from '@/components/finance/ProfitLossTab';
import { CashFlowTab } from '@/components/finance/CashFlowTab';
import { PayablesTab } from '@/components/finance/PayablesTab';
import { OwnerLoansTab } from '@/components/finance/OwnerLoansTab';
import { RowActions } from '@/components/ui/row-actions';
import { StatusBadge } from '@/components/ui/status-badge';

type AccountFormState = {
  accountCode: string;
  accountName: string;
  accountType: 'bank' | 'current' | 'cash' | 'petty_cash';
  bankName: string;
  branchName: string;
  accountNumberMasked: string;
  currencyCode: string;
  allowsCheque: string;
  openingBalance: string;
  openingBalanceDate: string;
  status: 'active' | 'inactive';
};

type ManualTransactionFormState = {
  transactionDate: string;
  transactionType: 'manual_inflow' | 'manual_outflow' | 'internal_transfer';
  financeAccountId: string;
  sourceFinanceAccountId: string;
  destinationFinanceAccountId: string;
  amount: string;
  referenceNumber: string;
  counterpartyName: string;
  narrative: string;
  tags: FinanceTagValue;
};

type PettyCashAllocationFormState = {
  sourceFinanceAccountId: string;
  pettyCashAccountId: string;
  allocatedToUserId: string;
  amount: string;
  allocationDate: string;
  purpose: string;
};

type PettyCashExpenseFormState = {
  expenseDate: string;
  tags: FinanceTagValue;
  amount: string;
  justification: string;
};

type ChequeBookFormState = {
  financeAccountId: string;
  bookCode: string;
  startNumber: string;
  endNumber: string;
  issuedDate: string;
};

const today = new Date().toISOString().split('T')[0];

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  accountCode: '',
  accountName: '',
  accountType: 'bank',
  bankName: '',
  branchName: '',
  accountNumberMasked: '',
  currencyCode: 'LKR',
  allowsCheque: 'false',
  openingBalance: '0',
  openingBalanceDate: today,
  status: 'active',
};

const EMPTY_MANUAL_TRANSACTION_FORM: ManualTransactionFormState = {
  transactionDate: today,
  transactionType: 'manual_outflow',
  financeAccountId: '',
  sourceFinanceAccountId: '',
  destinationFinanceAccountId: '',
  amount: '',
  referenceNumber: '',
  counterpartyName: '',
  narrative: '',
  tags: EMPTY_FINANCE_TAGS,
};

const EMPTY_PETTY_CASH_ALLOCATION_FORM: PettyCashAllocationFormState = {
  sourceFinanceAccountId: '',
  pettyCashAccountId: '',
  allocatedToUserId: '',
  amount: '',
  allocationDate: today,
  purpose: '',
};

const EMPTY_PETTY_CASH_EXPENSE_FORM: PettyCashExpenseFormState = {
  expenseDate: today,
  tags: EMPTY_FINANCE_TAGS,
  amount: '',
  justification: '',
};

const EMPTY_CHEQUE_BOOK_FORM: ChequeBookFormState = {
  financeAccountId: '',
  bookCode: '',
  startNumber: '',
  endNumber: '',
  issuedDate: today,
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: 'Bank',
  current: 'Current',
  cash: 'Cash',
  petty_cash: 'Petty Cash',
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  customer_receipt: 'Customer Receipt',
  customer_receipt_reversal: 'Receipt Reversal',
  payroll_disbursement: 'Payroll Disbursement',
  supplier_payment: 'Supplier Payment',
  manual_inflow: 'Manual Inflow',
  manual_outflow: 'Manual Outflow',
  internal_transfer: 'Internal Transfer',
  petty_cash_allocation: 'Petty Cash Allocation',
  petty_cash_expense: 'Petty Cash Expense',
};

function AccountTypeBadge({ type }: { type: string }) {
  return <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[type] ?? type}</Badge>;
}

export default function TreasuryPage() {
  const { hasPermission, currentUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  // The tab lives in the address so links like /treasury?tab=payables open it
  const activeTab = searchParams.get('tab') ?? 'overview';
  const setActiveTab = (tab: string) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', tab); return next; }, { replace: true });
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showManualTransaction, setShowManualTransaction] = useState(false);
  const [showCreateAllocation, setShowCreateAllocation] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showCreateChequeBook, setShowCreateChequeBook] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<number>();
  const [selectedAllocationId, setSelectedAllocationId] = useState<number>();
  const [transactionAccountFilter, setTransactionAccountFilter] = useState<string>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<string>('all');
  const [chequeAccountFilter, setChequeAccountFilter] = useState<string>('all');
  const [chequeStatusFilter, setChequeStatusFilter] = useState<string>('all');
  const [accountForm, setAccountForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [manualTransactionForm, setManualTransactionForm] = useState<ManualTransactionFormState>(EMPTY_MANUAL_TRANSACTION_FORM);
  const [allocationForm, setAllocationForm] = useState<PettyCashAllocationFormState>(EMPTY_PETTY_CASH_ALLOCATION_FORM);
  const [expenseForm, setExpenseForm] = useState<PettyCashExpenseFormState>(EMPTY_PETTY_CASH_EXPENSE_FORM);
  const [chequeBookForm, setChequeBookForm] = useState<ChequeBookFormState>(EMPTY_CHEQUE_BOOK_FORM);

  const canManageAccounts = hasPermission('treasury:accounts:manage');
  const canManageTransactions = hasPermission('treasury:transactions:manage');
  const canSeeFinancialReports = hasPermission('reports:financial:read');
  const canManagePettyCash = hasPermission('treasury:petty_cash:manage');
  const canSubmitPettyCash = hasPermission('treasury:petty_cash:submit');
  const canReviewPettyCash = hasPermission('treasury:petty_cash:review');

  const accountsQuery = useTreasuryAccounts();
  const chequeBooksQuery = useChequeBooks();
  const chequeLeavesQuery = useChequeLeaves({
    accountId: chequeAccountFilter !== 'all' ? Number(chequeAccountFilter) : undefined,
    status: chequeStatusFilter !== 'all' ? chequeStatusFilter : undefined,
  });
  const chequeOverviewQuery = useChequeOverview();
  const transactionsQuery = useTreasuryTransactions({
    accountId: transactionAccountFilter !== 'all' ? Number(transactionAccountFilter) : undefined,
    transactionType: transactionTypeFilter !== 'all' ? transactionTypeFilter : undefined,
    status: transactionStatusFilter !== 'all' ? transactionStatusFilter : undefined,
  });
  const transactionDetailQuery = useTreasuryTransaction(selectedTransactionId);
  const managersQuery = useTreasuryManagers();
  const pettyCashAllocationsQuery = usePettyCashAllocations();
  const pettyCashAllocationDetailQuery = usePettyCashAllocation(selectedAllocationId);

  const createAccountMutation = useCreateTreasuryAccount();
  const createChequeBookMutation = useCreateChequeBook();
  const createManualTransactionMutation = useCreateManualTreasuryTransaction();
  const createAllocationMutation = useCreatePettyCashAllocation();
  const createExpenseMutation = useCreatePettyCashExpense(selectedAllocationId);
  const reviewExpenseMutation = useReviewPettyCashExpense();
  const updateChequeLeafStatusMutation = useUpdateChequeLeafStatus();
  const updatePaymentMutation = useUpdatePayment();

  const accounts = accountsQuery.data?.data ?? [];
  const chequeBooks = chequeBooksQuery.data?.data ?? [];
  const chequeLeaves = chequeLeavesQuery.data?.data ?? [];
  const chequeOverview = chequeOverviewQuery.data?.data;
  const outgoingCheques = chequeOverview?.outgoingCheques ?? [];
  const pendingIncomingReceipts = chequeOverview?.pendingIncomingReceipts ?? [];
  const bouncedIncomingReceipts = chequeOverview?.bouncedIncomingReceipts ?? [];
  const transactions = transactionsQuery.data?.data ?? [];
  const managers = managersQuery.data?.data ?? [];
  const allocations = pettyCashAllocationsQuery.data?.data ?? [];

  const activeAccounts = accounts.filter((account) => account.status === 'active');
  const liquidAccounts = activeAccounts.filter((account) => account.accountType !== 'petty_cash');
  const pettyCashAccounts = activeAccounts.filter((account) => account.accountType === 'petty_cash');
  const chequeEnabledAccounts = activeAccounts.filter(
    (account) => account.accountType === 'current' && account.allowsCheque,
  );

  // Cheap to compute; recalculated each render so it can never go stale
  const overview = (() => {
    const totalBalance = accounts.reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
    const bankBalance = accounts
      .filter((account) => ['bank', 'current'].includes(account.accountType))
      .reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
    const cashBalance = accounts
      .filter((account) => ['cash', 'petty_cash'].includes(account.accountType))
      .reduce((sum, account) => sum + (account.currentBalance ?? 0), 0);
    const salesInflows = transactions.filter((transaction) => transaction.transactionType === 'customer_receipt').length;
    const payrollOutflows = transactions.filter((transaction) => transaction.transactionType === 'payroll_disbursement').length;
    const supplierPayments = transactions.filter((transaction) => transaction.transactionType === 'supplier_payment').length;
    const pendingPettyCash = allocations.filter((allocation) => allocation.status === 'submitted').length;
    const issuedOutgoingCheques = outgoingCheques.filter((cheque) => cheque.status === 'issued').length;
    const bouncedCheques = outgoingCheques.filter((cheque) => cheque.status === 'bounced').length;
    const pendingIncomingCheques = pendingIncomingReceipts.length;
    const bouncedIncomingCheques = bouncedIncomingReceipts.length;

    return {
      totalBalance,
      bankBalance,
      cashBalance,
      salesInflows,
      payrollOutflows,
      supplierPayments,
      pendingPettyCash,
      issuedOutgoingCheques,
      bouncedCheques,
      pendingIncomingCheques,
      bouncedIncomingCheques,
      activeAccounts: accounts.filter((account) => account.status === 'active').length,
    };
  })();

  const recentTransactions = transactions.slice(0, 8);
  const schemaErrorMessage = [
    accountsQuery.error,
    chequeBooksQuery.error,
    chequeLeavesQuery.error,
    chequeOverviewQuery.error,
    transactionsQuery.error,
    pettyCashAllocationsQuery.error,
  ]
    .filter(Boolean)
    .map((error) => getApiErrorMessage(error, 'Treasury is unavailable right now.'))
    .find((message) => message.includes('schema') || message.includes('migrations'))
    ?? null;

  const handleCreateAccount = async () => {
    try {
      await createAccountMutation.mutateAsync({
        accountCode: accountForm.accountCode.trim(),
        accountName: accountForm.accountName.trim(),
        accountType: accountForm.accountType,
        bankName: accountForm.bankName.trim() || undefined,
        branchName: accountForm.branchName.trim() || undefined,
        accountNumberMasked: accountForm.accountNumberMasked.trim() || undefined,
        currencyCode: accountForm.currencyCode.trim() || 'LKR',
        allowsCheque: accountForm.allowsCheque === 'true',
        openingBalance: Number(accountForm.openingBalance || 0),
        openingBalanceDate: accountForm.openingBalanceDate || undefined,
        status: accountForm.status,
      });
      toast.success('Treasury account created');
      setAccountForm(EMPTY_ACCOUNT_FORM);
      setShowCreateAccount(false);
    } catch (error) {
      parseApiError(error, 'Failed to create treasury account');
    }
  };

  const handleCreateManualTransaction = async () => {
    try {
      await createManualTransactionMutation.mutateAsync({
        transactionDate: manualTransactionForm.transactionDate,
        transactionType: manualTransactionForm.transactionType,
        financeAccountId: manualTransactionForm.financeAccountId ? Number(manualTransactionForm.financeAccountId) : undefined,
        sourceFinanceAccountId: manualTransactionForm.sourceFinanceAccountId ? Number(manualTransactionForm.sourceFinanceAccountId) : undefined,
        destinationFinanceAccountId: manualTransactionForm.destinationFinanceAccountId ? Number(manualTransactionForm.destinationFinanceAccountId) : undefined,
        amount: Number(manualTransactionForm.amount),
        referenceNumber: manualTransactionForm.referenceNumber.trim() || undefined,
        counterpartyName: manualTransactionForm.counterpartyName.trim() || undefined,
        narrative: manualTransactionForm.narrative.trim(),
        ...(manualTransactionForm.transactionType === 'internal_transfer' ? {} : financeTagsToPayload(manualTransactionForm.tags)),
      });
      toast.success('Treasury movement recorded');
      setManualTransactionForm(EMPTY_MANUAL_TRANSACTION_FORM);
      setShowManualTransaction(false);
    } catch (error) {
      parseApiError(error, 'Failed to record treasury movement');
    }
  };

  const handleCreateChequeBook = async () => {
    try {
      await createChequeBookMutation.mutateAsync({
        financeAccountId: Number(chequeBookForm.financeAccountId),
        bookCode: chequeBookForm.bookCode.trim() || undefined,
        startNumber: Number(chequeBookForm.startNumber),
        endNumber: Number(chequeBookForm.endNumber),
        issuedDate: chequeBookForm.issuedDate,
      });
      toast.success('Cheque book created');
      setChequeBookForm(EMPTY_CHEQUE_BOOK_FORM);
      setShowCreateChequeBook(false);
    } catch (error) {
      parseApiError(error, 'Failed to create cheque book');
    }
  };

  const handleCreatePettyCashAllocation = async () => {
    try {
      await createAllocationMutation.mutateAsync({
        sourceFinanceAccountId: Number(allocationForm.sourceFinanceAccountId),
        pettyCashAccountId: Number(allocationForm.pettyCashAccountId),
        allocatedToUserId: Number(allocationForm.allocatedToUserId),
        amount: Number(allocationForm.amount),
        allocationDate: allocationForm.allocationDate,
        purpose: allocationForm.purpose.trim(),
      });
      toast.success('Petty cash allocated and posted to treasury');
      setAllocationForm(EMPTY_PETTY_CASH_ALLOCATION_FORM);
      setShowCreateAllocation(false);
    } catch (error) {
      parseApiError(error, 'Failed to allocate petty cash');
    }
  };

  const handleCreateExpense = async () => {
    if (!selectedAllocationId) return;

    try {
      await createExpenseMutation.mutateAsync({
        expenseDate: expenseForm.expenseDate,
        categoryId: Number(expenseForm.tags.categoryId),
        ...(expenseForm.tags.costCentreId ? { costCentreId: Number(expenseForm.tags.costCentreId) } : {}),
        amount: Number(expenseForm.amount),
        justification: expenseForm.justification.trim(),
      });
      toast.success('Petty cash expense submitted for review');
      setExpenseForm(EMPTY_PETTY_CASH_EXPENSE_FORM);
      setShowExpenseDialog(false);
    } catch (error) {
      parseApiError(error, 'Failed to submit petty cash expense');
    }
  };

  const handleReviewExpense = async (expenseId: number, status: 'approved' | 'rejected') => {
    try {
      await reviewExpenseMutation.mutateAsync({
        expenseId,
        data: { status },
      });
      toast.success(status === 'approved' ? 'Expense approved and posted to treasury' : 'Expense rejected');
    } catch (error) {
      parseApiError(error, 'Failed to review petty cash expense');
    }
  };

  const handleUpdateChequeLeafStatus = async (
    chequeLeafId: number,
    status: 'cleared' | 'bounced' | 'voided',
  ) => {
    try {
      await updateChequeLeafStatusMutation.mutateAsync({
        chequeLeafId,
        data: { status },
      });
      toast.success(`Cheque marked as ${status}`);
    } catch (error) {
      parseApiError(error, 'Failed to update cheque status');
    }
  };

  const handleUpdateIncomingReceiptStatus = async (
    paymentId: string,
    paymentStatus: 'completed' | 'bounced',
    financeAccountId?: number | null,
  ) => {
    try {
      await updatePaymentMutation.mutateAsync({
        paymentId,
        data: {
          paymentStatus,
          financeAccountId: financeAccountId ?? undefined,
        },
      });
      toast.success(paymentStatus === 'completed' ? 'Cheque receipt cleared into Treasury' : 'Cheque receipt bounced');
    } catch (error) {
      parseApiError(error, 'Failed to update cheque receipt status');
    }
  };

  const selectedAllocation = pettyCashAllocationDetailQuery.data?.data?.allocation;
  const selectedAllocationExpenses = pettyCashAllocationDetailQuery.data?.data?.expenses ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Money</h1>
          <p className="mt-1 text-muted-foreground">Every rupee in and out: accounts, receipts, payments, cheques and petty cash.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManagePettyCash ? (
            <Button variant="outline" onClick={() => setShowCreateAllocation(true)}>
              <HandCoins className="h-4 w-4" /> Petty cash
            </Button>
          ) : null}
          {canManageTransactions ? (
            <Button onClick={() => setShowManualTransaction(true)}>
              <Plus className="h-4 w-4" /> Record money movement
            </Button>
          ) : null}
        </div>
      </header>

      {schemaErrorMessage ? (
        <ErrorBanner title="Treasury schema is not ready" description={schemaErrorMessage} />
      ) : null}

      <section aria-label="Cash position" className="grid gap-4 rounded-3xl bg-panel p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:items-end">
        <div>
          <p className="text-[15px] font-semibold text-muted-foreground">Cash on hand</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">{formatCurrency(overview.totalBalance)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Across {overview.activeAccounts} active account{overview.activeAccounts === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl bg-card p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Landmark className="h-4 w-4" /> Bank & current</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(overview.bankBalance)}</p>
        </div>
        <div className="rounded-2xl bg-card p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="h-4 w-4" /> Cash & petty cash</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(overview.cashBalance)}</p>
        </div>
      </section>

      {overview.pendingPettyCash + overview.issuedOutgoingCheques + overview.pendingIncomingCheques + overview.bouncedIncomingCheques > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Needs attention">
          {overview.pendingPettyCash > 0 ? (
            <AttentionChip tone="info" onClick={() => setActiveTab('petty-cash')}>{overview.pendingPettyCash} petty cash to review</AttentionChip>
          ) : null}
          {overview.issuedOutgoingCheques > 0 ? (
            <AttentionChip tone="warning" onClick={() => setActiveTab('cheques')}>{overview.issuedOutgoingCheques} cheque{overview.issuedOutgoingCheques === 1 ? '' : 's'} issued, not cleared</AttentionChip>
          ) : null}
          {overview.pendingIncomingCheques > 0 ? (
            <AttentionChip tone="warning" onClick={() => setActiveTab('cheques')}>{overview.pendingIncomingCheques} buyer cheque{overview.pendingIncomingCheques === 1 ? '' : 's'} to deposit</AttentionChip>
          ) : null}
          {overview.bouncedIncomingCheques > 0 ? (
            <AttentionChip tone="danger" onClick={() => setActiveTab('cheques')}>{overview.bouncedIncomingCheques} bounced buyer cheque{overview.bouncedIncomingCheques === 1 ? '' : 's'}</AttentionChip>
          ) : null}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto sm:w-auto">
          {/* Day-to-day money first, then what is owed, then the reports, then setup. */}
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="cheques">Cheques</TabsTrigger>
          <TabsTrigger value="petty-cash">Petty cash</TabsTrigger>
          <TabsTrigger value="payables">Payables</TabsTrigger>
          <TabsTrigger value="owner-loans">Owner &amp; loans</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          {canSeeFinancialReports ? <TabsTrigger value="pnl">Profit &amp; loss</TabsTrigger> : null}
          {canSeeFinancialReports ? <TabsTrigger value="cash-flow">Cash flow</TabsTrigger> : null}
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <MoneyLedgerTab
            accounts={accounts}
            canManage={canManageTransactions}
            onOpenTransaction={setSelectedTransactionId}
          />
        </TabsContent>

        <TabsContent value="pnl"><ProfitLossTab /></TabsContent>
        <TabsContent value="cash-flow"><CashFlowTab /></TabsContent>
        <TabsContent value="payables"><PayablesTab /></TabsContent>
        <TabsContent value="owner-loans"><OwnerLoansTab canManage={canManageTransactions} /></TabsContent>

        <TabsContent value="setup">
          <FinanceSetupTab canManage={canManageAccounts} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Account Snapshot</CardTitle>
                <CardDescription>Quick view of where money currently sits.</CardDescription>
              </CardHeader>
              <CardContent>
                {accountsQuery.isLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-28 rounded-xl" />
                    ))}
                  </div>
                ) : accountsQuery.error ? (
                  <InlineErrorCard message={getApiErrorMessage(accountsQuery.error, 'Failed to load treasury accounts.')} />
                ) : accounts.length === 0 ? (
                  <EmptyState
                    title="No treasury accounts yet"
                    description="Create your first bank, current, cash, or petty cash account to start posting the farm’s money movements into treasury."
                    actionLabel={canManageAccounts ? 'Create Account' : undefined}
                    onAction={canManageAccounts ? () => setShowCreateAccount(true) : undefined}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {accounts.map((account) => (
                      <div key={account.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{account.accountName}</p>
                            <p className="text-xs text-muted-foreground">{account.accountCode}</p>
                          </div>
                          <AccountTypeBadge type={account.accountType} />
                        </div>
                        <p className="mt-4 text-2xl font-semibold tracking-tight">{formatCurrency(account.currentBalance ?? 0)}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge status={account.status} />
                          {account.bankName ? <span>{account.bankName}</span> : null}
                          {account.allowsCheque ? <span>Cheque enabled</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Treasury Activity</CardTitle>
                <CardDescription>The latest posted money movements recorded in treasury.</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 rounded-lg" />
                    ))}
                  </div>
                ) : transactionsQuery.error ? (
                  <InlineErrorCard message={getApiErrorMessage(transactionsQuery.error, 'Failed to load treasury transactions.')} />
                ) : recentTransactions.length === 0 ? (
                  <EmptyState
                    title="No treasury transactions yet"
                    description="Sales receipts, payroll payouts, manual treasury postings, and petty cash flows will appear here once they are recorded."
                  />
                ) : (
                  <div className="space-y-3">
                    {recentTransactions.map((transaction) => (
                      <button
                        key={transaction.id}
                        type="button"
                        onClick={() => setSelectedTransactionId(transaction.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{transaction.transactionCode}</span>
                            <StatusBadge status={transaction.status} />
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {TRANSACTION_TYPE_LABELS[transaction.transactionType] ?? transaction.transactionType.replace(/_/g, ' ')}
                            {transaction.counterpartyNameSnapshot ? ` • ${transaction.counterpartyNameSnapshot}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{new Date(String(transaction.transactionDate)).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">{transaction.sourceModule ?? 'manual'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Integration Coverage</CardTitle>
              <CardDescription>What treasury is currently linked to in the product.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <CoverageTile title="Sales Receipts" description="Buyer receipts post directly into the selected treasury account." value={String(overview.salesInflows)} />
              <CoverageTile title="Payroll" description="Paid payroll records create treasury outflows against the paying account." value={String(overview.payrollOutflows)} />
              <CoverageTile title="Procurement" description="Supplier payments now post from Treasury and stay linked to purchase orders." value={String(overview.supplierPayments)} />
              <CoverageTile title="Cheque Control" description="Treasury tracks issued outgoing cheques and pending incoming buyer cheques centrally." value={String(overview.issuedOutgoingCheques + overview.pendingIncomingCheques)} />
              <CoverageTile title="Other Farm Cash" description="Manual treasury entries capture money in, money out, and internal account transfers." value={String(transactions.filter((t) => ['manual_inflow', 'manual_outflow', 'internal_transfer'].includes(t.transactionType)).length)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cheques" className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Cheque Control</h2>
              <p className="text-sm text-muted-foreground">
                Manage cheque books, clear or bounce incoming buyer cheques, and monitor outgoing cheque payouts from current accounts.
              </p>
            </div>
            {canManageAccounts ? (
              <Button className="min-h-11 gap-2" onClick={() => setShowCreateChequeBook(true)}>
                <Plus className="h-4 w-4" />
                New Cheque Book
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Cheque Books" value={String(chequeBooks.length)} description="Cheque books issued against current accounts" icon={Landmark} />
            <MetricCard title="Available Leaves" value={String(chequeLeaves.filter((leaf) => leaf.status === 'available').length)} description="Unused cheque leaves ready for issuance" icon={Wallet} />
            <MetricCard title="Issued Outgoing" value={String(overview.issuedOutgoingCheques)} description="Supplier or payroll cheques waiting to clear" icon={ArrowRightLeft} />
            <MetricCard title="Bounced Items" value={String(overview.bouncedCheques + overview.bouncedIncomingCheques)} description="Outgoing and incoming cheque history marked bounced" icon={CircleAlert} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Pending Buyer Cheque Receipts</CardTitle>
                <CardDescription>These receipts do not affect Treasury balances until they are cleared.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {chequeOverviewQuery.isLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 rounded-lg" />
                    ))}
                  </div>
                ) : chequeOverviewQuery.error ? (
                  <div className="p-6">
                    <InlineErrorCard message={getApiErrorMessage(chequeOverviewQuery.error, 'Failed to load pending buyer cheques.')} />
                  </div>
                ) : pendingIncomingReceipts.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      title="No pending buyer cheques"
                      description="Incoming cheque receipts will appear here until they are cleared or bounced."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead>Cheque</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableActionsHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingIncomingReceipts.map((receipt) => (
                          <TableRow key={receipt.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{receipt.receiptCode}</p>
                                <p className="text-xs text-muted-foreground">{new Date(receipt.receiptDate).toLocaleDateString()}</p>
                              </div>
                            </TableCell>
                            <TableCell>{receipt.buyerName}</TableCell>
                            <TableCell>
                              <div>
                                <p>{receipt.chequeNumber ?? '--'}</p>
                                <p className="text-xs text-muted-foreground">{receipt.bankName ?? 'Bank not recorded'}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {receipt.financeAccountName
                                ?? (receipt.financeAccountId
                                  ? accounts.find((account) => account.id === receipt.financeAccountId)?.accountName ?? `Account #${receipt.financeAccountId}`
                                  : null)
                                ?? <span className="text-xs text-warning">Needs account link</span>}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(Number(receipt.paymentAmount))}</TableCell>
                            <TableCell><StatusBadge status={receipt.paymentStatus} /></TableCell>
                            <TableActionsCell>
                              <RowActions
                                label={`receipt ${receipt.receiptCode}`}
                                actions={[
                                  {
                                    label: 'Clear',
                                    icon: Check,
                                    primary: true,
                                    hidden: !canManageTransactions,
                                    disabled: updatePaymentMutation.isPending || !receipt.financeAccountId,
                                    onSelect: () => void handleUpdateIncomingReceiptStatus(receipt.id, 'completed', receipt.financeAccountId),
                                  },
                                  {
                                    label: 'Bounce',
                                    icon: X,
                                    primary: true,
                                    destructive: true,
                                    hidden: !canManageTransactions,
                                    disabled: updatePaymentMutation.isPending,
                                    onSelect: () => void handleUpdateIncomingReceiptStatus(receipt.id, 'bounced', receipt.financeAccountId),
                                  },
                                ]}
                              />
                            </TableActionsCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bounced Incoming History</CardTitle>
                <CardDescription>Buyer cheque receipts that were reversed and kept as treasury-visible history.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {chequeOverviewQuery.isLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 rounded-lg" />
                    ))}
                  </div>
                ) : bouncedIncomingReceipts.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      title="No bounced incoming cheques"
                      description="Bounced buyer cheques stay here as history after the treasury reversal is recorded."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead>Cheque</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Treasury</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bouncedIncomingReceipts.map((receipt) => (
                          <TableRow key={receipt.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{receipt.receiptCode}</p>
                                <p className="text-xs text-muted-foreground">{new Date(receipt.receiptDate).toLocaleDateString()}</p>
                              </div>
                            </TableCell>
                            <TableCell>{receipt.buyerName}</TableCell>
                            <TableCell>
                              <div>
                                <p>{receipt.chequeNumber ?? '--'}</p>
                                <p className="text-xs text-muted-foreground">{receipt.bankName ?? 'Bank not recorded'}</p>
                              </div>
                            </TableCell>
                            <TableCell>{receipt.financeAccountName || (receipt.financeAccountId ? `Account #${receipt.financeAccountId}` : '--')}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(Number(receipt.paymentAmount))}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div className="space-y-1">
                                <p>{receipt.treasuryTransactionId ? `Txn #${receipt.treasuryTransactionId}` : 'No original posting'}</p>
                                <p>{receipt.treasuryReversalTransactionId ? `Reversal #${receipt.treasuryReversalTransactionId}` : 'No reversal recorded'}</p>
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={receipt.paymentStatus} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outgoing Cheques</CardTitle>
                <CardDescription>Issued cheque disbursements from payroll and supplier payments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Current Account</Label>
                    <Select value={chequeAccountFilter} onValueChange={setChequeAccountFilter}>
                      <SelectTrigger className="min-h-11"><SelectValue placeholder="All cheque accounts" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All cheque accounts</SelectItem>
                        {chequeEnabledAccounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            {account.accountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Leaf Status</Label>
                    <Select value={chequeStatusFilter} onValueChange={setChequeStatusFilter}>
                      <SelectTrigger className="min-h-11"><SelectValue placeholder="All cheque statuses" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All cheque statuses</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="bounced">Bounced</SelectItem>
                        <SelectItem value="voided">Voided</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {chequeLeavesQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 rounded-lg" />
                    ))}
                  </div>
                ) : chequeLeavesQuery.error ? (
                  <InlineErrorCard message={getApiErrorMessage(chequeLeavesQuery.error, 'Failed to load cheque leaves.')} />
                ) : chequeLeaves.length === 0 ? (
                  <EmptyState
                    title="No cheque leaves found"
                    description="Create a cheque book in Treasury to start issuing supplier or payroll cheques."
                  />
                ) : (
                  <div className="space-y-3">
                    {chequeLeaves.map((leaf) => (
                      <div key={leaf.id} className="rounded-xl border border-border/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground">{leaf.chequeNumber}</p>
                              <StatusBadge status={leaf.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {leaf.accountName ?? '--'}{leaf.bookCode ? ` • ${leaf.bookCode}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{leaf.amount ? formatCurrency(Number(leaf.amount)) : '--'}</p>
                            <p className="text-xs text-muted-foreground">{leaf.payeeName ?? 'Unassigned payee'}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{leaf.sourceEntityType ? `${leaf.sourceEntityType.replace(/_/g, ' ')} #${leaf.sourceEntityId}` : 'No source link yet'}</span>
                          <span>
                            {leaf.issueDate ? `Issued ${new Date(leaf.issueDate).toLocaleDateString()}` : 'Not issued'}
                            {leaf.clearDate ? ` • Cleared ${new Date(leaf.clearDate).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                        {canManageTransactions && leaf.status === 'issued' ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={updateChequeLeafStatusMutation.isPending}
                              onClick={() => void handleUpdateChequeLeafStatus(leaf.id, 'cleared')}
                            >
                              Mark Cleared
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateChequeLeafStatusMutation.isPending}
                              onClick={() => void handleUpdateChequeLeafStatus(leaf.id, 'bounced')}
                            >
                              Mark Bounced
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateChequeLeafStatusMutation.isPending}
                              onClick={() => void handleUpdateChequeLeafStatus(leaf.id, 'voided')}
                            >
                              Void
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cheque Books</CardTitle>
              <CardDescription>Track issued cheque books and their available leaves per current account.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {chequeBooksQuery.isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : chequeBooksQuery.error ? (
                <div className="p-6">
                  <InlineErrorCard message={getApiErrorMessage(chequeBooksQuery.error, 'Failed to load cheque books.')} />
                </div>
              ) : chequeBooks.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No cheque books configured"
                    description="Add a cheque book for a cheque-enabled current account to support supplier and payroll cheque issuance."
                    actionLabel={canManageAccounts ? 'Create Cheque Book' : undefined}
                    onAction={canManageAccounts ? () => setShowCreateChequeBook(true) : undefined}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Book</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Issued Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Leaves</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chequeBooks.map((book) => (
                        <TableRow key={book.id}>
                          <TableCell className="font-medium">{book.bookCode}</TableCell>
                          <TableCell>{book.accountName ?? `Account #${book.financeAccountId}`}</TableCell>
                          <TableCell>{book.startNumber} - {book.endNumber}</TableCell>
                          <TableCell>{new Date(book.issuedDate).toLocaleDateString()}</TableCell>
                          <TableCell><StatusBadge status={book.status} /></TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium">{book.availableLeaves}</span>
                            <span className="text-xs text-muted-foreground"> available / {book.issuedLeaves} issued</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Treasury Accounts</h2>
              <p className="text-sm text-muted-foreground">Create and monitor bank, current, cash, and petty cash accounts.</p>
            </div>
            {canManageAccounts ? (
              <Button className="min-h-11 gap-2" onClick={() => setShowCreateAccount(true)}>
                <Plus className="h-4 w-4" />
                New Account
              </Button>
            ) : null}
          </div>

          <Card>
            <CardContent className="p-0">
              {accountsQuery.isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : accountsQuery.error ? (
                <div className="p-6">
                  <InlineErrorCard message={getApiErrorMessage(accountsQuery.error, 'Failed to load treasury accounts.')} />
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No accounts configured"
                    description="Treasury accounts are required before receipts, payroll, or petty cash movements can affect the farm’s central cash ledger."
                    actionLabel={canManageAccounts ? 'Create Account' : undefined}
                    onAction={canManageAccounts ? () => setShowCreateAccount(true) : undefined}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{account.accountName}</p>
                              <p className="text-xs text-muted-foreground">{account.accountCode}</p>
                            </div>
                          </TableCell>
                          <TableCell><AccountTypeBadge type={account.accountType} /></TableCell>
                          <TableCell className="text-muted-foreground">{account.bankName ?? '--'}</TableCell>
                          <TableCell><StatusBadge status={account.status} /></TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(account.openingBalance ?? 0))}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(account.currentBalance ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 md:grid-cols-3 lg:flex-1">
              <div className="grid gap-2">
                <Label>Account</Label>
                <Select value={transactionAccountFilter} onValueChange={setTransactionAccountFilter}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.accountName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Transaction Type</Label>
                <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="All transaction types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All transaction types</SelectItem>
                    {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={transactionStatusFilter} onValueChange={setTransactionStatusFilter}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    <SelectItem value="reversed">Reversed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canManageTransactions ? (
              <Button className="min-h-11 gap-2" onClick={() => setShowManualTransaction(true)}>
                <Plus className="h-4 w-4" />
                Manual Movement
              </Button>
            ) : null}
          </div>

          <Card>
            <CardContent className="p-0">
              {transactionsQuery.isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : transactionsQuery.error ? (
                <div className="p-6">
                  <InlineErrorCard message={getApiErrorMessage(transactionsQuery.error, 'Failed to load treasury transactions.')} />
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No transactions match this view"
                    description="Adjust the filters or post a sales receipt, payroll payout, or manual movement into treasury to start the ledger."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Counterparty</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Cost centre</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableActionsHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id} onOpen={() => setSelectedTransactionId(transaction.id)}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{transaction.transactionCode}</p>
                              <p className="text-xs text-muted-foreground">{transaction.referenceNumber ?? '--'}</p>
                            </div>
                          </TableCell>
                          <TableCell>{TRANSACTION_TYPE_LABELS[transaction.transactionType] ?? transaction.transactionType.replace(/_/g, ' ')}</TableCell>
                          <TableCell>{transaction.counterpartyNameSnapshot ?? '--'}</TableCell>
                          <TableCell>
                            {transaction.hasUncategorized ? (
                              <Badge variant="outline" className="border-warning/30 text-warning">Needs review</Badge>
                            ) : (transaction.categoryNames ?? '--')}
                          </TableCell>
                          <TableCell>{transaction.costCentreNames ?? '--'}</TableCell>
                          <TableCell>{new Date(String(transaction.transactionDate)).toLocaleDateString()}</TableCell>
                          <TableCell><StatusBadge status={transaction.status} /></TableCell>
                          <TableCell className="capitalize">{transaction.sourceModule ?? '--'}</TableCell>
                          <TableActionsCell>
                            <RowActions label={`transaction ${transaction.transactionCode}`} open={() => setSelectedTransactionId(transaction.id)} />
                          </TableActionsCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="petty-cash" className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Petty Cash Control</h2>
              <p className="text-sm text-muted-foreground">Allocate farm cash, collect manager justifications, and review expenses centrally.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManagePettyCash ? (
                <Button variant="outline" className="min-h-11 gap-2" onClick={() => setShowCreateAllocation(true)}>
                  <HandCoins className="h-4 w-4" />
                  Allocate Petty Cash
                </Button>
              ) : null}
              {canSubmitPettyCash && selectedAllocation ? (
                <Button className="min-h-11 gap-2" onClick={() => setShowExpenseDialog(true)}>
                  <Plus className="h-4 w-4" />
                  Submit Expense
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Allocations</CardTitle>
                <CardDescription>Petty cash assigned to farm managers and its current review state.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {pettyCashAllocationsQuery.isLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 rounded-lg" />
                    ))}
                  </div>
                ) : pettyCashAllocationsQuery.error ? (
                  <div className="p-6">
                    <InlineErrorCard message={getApiErrorMessage(pettyCashAllocationsQuery.error, 'Failed to load petty cash allocations.')} />
                  </div>
                ) : allocations.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      title="No petty cash allocations yet"
                      description="Allocate petty cash to a manager, then use this space to track supporting justifications and review decisions."
                      actionLabel={canManagePettyCash ? 'Allocate Petty Cash' : undefined}
                      onAction={canManagePettyCash ? () => setShowCreateAllocation(true) : undefined}
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Allocation</TableHead>
                          <TableHead>Manager</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableActionsHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map((allocation) => (
                          <TableRow key={allocation.id} onOpen={() => setSelectedAllocationId(allocation.id)}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{allocation.allocationCode}</p>
                                <p className="text-xs text-muted-foreground">{allocation.purpose}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{allocation.allocatedToName ?? '--'}</p>
                                <p className="text-xs text-muted-foreground">{allocation.siteName ?? 'No site'}</p>
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={allocation.status} /></TableCell>
                            <TableCell className="text-right">
                              <p className="font-medium">{formatCurrency(Number(allocation.amount))}</p>
                              <p className="text-xs text-muted-foreground">
                                Spent {formatCurrency(Number(allocation.approvedExpenseAmount ?? 0))}
                              </p>
                            </TableCell>
                            <TableActionsCell>
                              <RowActions label={`allocation ${allocation.allocationCode}`} open={() => setSelectedAllocationId(allocation.id)} />
                            </TableActionsCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Allocation Detail</CardTitle>
                <CardDescription>Review submitted justifications and post approved expenses into treasury.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAllocationId == null ? (
                  <EmptyState
                    title="Select an allocation"
                    description="Choose a petty cash allocation to review its expense submissions and current remaining balance."
                  />
                ) : pettyCashAllocationDetailQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 rounded-lg" />
                    <Skeleton className="h-56 rounded-lg" />
                  </div>
                ) : pettyCashAllocationDetailQuery.error ? (
                  <InlineErrorCard message={getApiErrorMessage(pettyCashAllocationDetailQuery.error, 'Failed to load petty cash allocation detail.')} />
                ) : selectedAllocation ? (
                  <>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{selectedAllocation.allocationCode}</p>
                          <p className="text-sm text-muted-foreground">{selectedAllocation.purpose}</p>
                        </div>
                        <StatusBadge status={selectedAllocation.status} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Manager</p>
                          <p className="mt-1 text-sm">{selectedAllocation.allocatedToName ?? '--'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Allocated Amount</p>
                          <p className="mt-1 text-sm">{formatCurrency(Number(selectedAllocation.amount))}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved Spend</p>
                          <p className="mt-1 text-sm">{formatCurrency(selectedAllocationExpenses.filter((expense) => expense.status === 'approved').reduce((sum, expense) => sum + Number(expense.amount), 0))}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
                          <p className="mt-1 text-sm">
                            {formatCurrency(
                              Number(selectedAllocation.amount)
                              - selectedAllocationExpenses
                                .filter((expense) => expense.status === 'approved')
                                .reduce((sum, expense) => sum + Number(expense.amount), 0),
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedAllocationExpenses.length === 0 ? (
                      <EmptyState
                        title="No expense justifications yet"
                        description={
                          canSubmitPettyCash && selectedAllocation.allocatedToUserId === currentUser?.id
                            ? 'Use Submit Expense to record how this petty cash allocation is being used.'
                            : 'The assigned manager has not submitted any expense justifications yet.'
                        }
                        actionLabel={canSubmitPettyCash ? 'Submit Expense' : undefined}
                        onAction={canSubmitPettyCash ? () => setShowExpenseDialog(true) : undefined}
                      />
                    ) : (
                      <div className="space-y-3">
                        {selectedAllocationExpenses.map((expense) => (
                          <div key={expense.id} className="rounded-xl border border-border/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">{expense.expenseCategory}</p>
                                <p className="text-sm text-muted-foreground">{expense.justification}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(Number(expense.amount))}</p>
                                <div className="mt-1"><StatusBadge status={expense.status} /></div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span>{new Date(String(expense.expenseDate)).toLocaleDateString()}</span>
                              {expense.treasuryTransactionId ? <span>Posted as treasury transaction #{expense.treasuryTransactionId}</span> : null}
                            </div>
                            {canReviewPettyCash && expense.status === 'submitted' ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void handleReviewExpense(expense.id, 'approved')}
                                  disabled={reviewExpenseMutation.isPending}
                                >
                                  Approve & Post
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleReviewExpense(expense.id, 'rejected')}
                                  disabled={reviewExpenseMutation.isPending}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState title="Allocation not found" description="The selected petty cash allocation could not be loaded." />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateAccount} onOpenChange={setShowCreateAccount}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Treasury Account</DialogTitle>
            <DialogDescription>
              Add the internal account where receipts and payments should affect the central treasury balance.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Account Code</Label>
              <Input value={accountForm.accountCode} onChange={(e) => setAccountForm((prev) => ({ ...prev, accountCode: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Account Name</Label>
              <Input value={accountForm.accountName} onChange={(e) => setAccountForm((prev) => ({ ...prev, accountName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Account Type</Label>
              <Select
                value={accountForm.accountType}
                onValueChange={(value: AccountFormState['accountType']) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    accountType: value,
                    allowsCheque: value === 'current' ? prev.allowsCheque : 'false',
                  }))
                }
              >
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="petty_cash">Petty Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={accountForm.status} onValueChange={(value: 'active' | 'inactive') => setAccountForm((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Bank Name</Label>
              <Input value={accountForm.bankName} onChange={(e) => setAccountForm((prev) => ({ ...prev, bankName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Branch Name</Label>
              <Input value={accountForm.branchName} onChange={(e) => setAccountForm((prev) => ({ ...prev, branchName: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Masked Account Number</Label>
              <Input placeholder="e.g. ****1234" value={accountForm.accountNumberMasked} onChange={(e) => setAccountForm((prev) => ({ ...prev, accountNumberMasked: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Input value={accountForm.currencyCode} onChange={(e) => setAccountForm((prev) => ({ ...prev, currencyCode: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Opening Balance</Label>
              <Input type="number" min="0" step="0.01" value={accountForm.openingBalance} onChange={(e) => setAccountForm((prev) => ({ ...prev, openingBalance: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Opening Balance Date</Label>
              <Input type="date" value={accountForm.openingBalanceDate} onChange={(e) => setAccountForm((prev) => ({ ...prev, openingBalanceDate: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Cheque Usage</Label>
              <Select value={accountForm.allowsCheque} onValueChange={(value) => setAccountForm((prev) => ({ ...prev, allowsCheque: value }))}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Cheque not enabled</SelectItem>
                  <SelectItem value="true" disabled={accountForm.accountType !== 'current'}>
                    Cheque enabled
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccount(false)}>Cancel</Button>
            <Button onClick={handleCreateAccount} disabled={createAccountMutation.isPending}>
              {createAccountMutation.isPending ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateChequeBook} onOpenChange={setShowCreateChequeBook}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Cheque Book</DialogTitle>
            <DialogDescription>
              Register a cheque-number range against a cheque-enabled current account so payroll and supplier payments can reserve leaves.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Current Account</Label>
              <Select
                value={chequeBookForm.financeAccountId}
                onValueChange={(value) => setChequeBookForm((prev) => ({ ...prev, financeAccountId: value }))}
              >
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Select current account" /></SelectTrigger>
                <SelectContent>
                  {chequeEnabledAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Book Code</Label>
              <Input
                value={chequeBookForm.bookCode}
                placeholder="Optional auto-generated code"
                onChange={(e) => setChequeBookForm((prev) => ({ ...prev, bookCode: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Issued Date</Label>
              <Input
                type="date"
                value={chequeBookForm.issuedDate}
                onChange={(e) => setChequeBookForm((prev) => ({ ...prev, issuedDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Start Number</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={chequeBookForm.startNumber}
                onChange={(e) => setChequeBookForm((prev) => ({ ...prev, startNumber: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>End Number</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={chequeBookForm.endNumber}
                onChange={(e) => setChequeBookForm((prev) => ({ ...prev, endNumber: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateChequeBook(false)}>Cancel</Button>
            <Button onClick={handleCreateChequeBook} disabled={createChequeBookMutation.isPending}>
              {createChequeBookMutation.isPending ? 'Creating...' : 'Create Cheque Book'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showManualTransaction} onOpenChange={setShowManualTransaction}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Treasury Movement</DialogTitle>
            <DialogDescription>
              Use this for farm money movements that do not yet come from a dedicated source workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={manualTransactionForm.transactionDate} onChange={(e) => setManualTransactionForm((prev) => ({ ...prev, transactionDate: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Movement Type</Label>
              <Select
                value={manualTransactionForm.transactionType}
                onValueChange={(value: ManualTransactionFormState['transactionType']) =>
                  setManualTransactionForm((prev) => ({
                    ...prev,
                    transactionType: value,
                    financeAccountId: '',
                    sourceFinanceAccountId: '',
                    destinationFinanceAccountId: '',
                  }))
                }
              >
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_inflow">Manual Inflow</SelectItem>
                  <SelectItem value="manual_outflow">Manual Outflow</SelectItem>
                  <SelectItem value="internal_transfer">Internal Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {manualTransactionForm.transactionType === 'internal_transfer' ? (
              <>
                <div className="grid gap-2">
                  <Label>Source Account</Label>
                  <Select value={manualTransactionForm.sourceFinanceAccountId} onValueChange={(value) => setManualTransactionForm((prev) => ({ ...prev, sourceFinanceAccountId: value }))}>
                    <SelectTrigger className="min-h-11"><SelectValue placeholder="Select source account" /></SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>{account.accountName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Destination Account</Label>
                  <Select value={manualTransactionForm.destinationFinanceAccountId} onValueChange={(value) => setManualTransactionForm((prev) => ({ ...prev, destinationFinanceAccountId: value }))}>
                    <SelectTrigger className="min-h-11"><SelectValue placeholder="Select destination account" /></SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>{account.accountName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="grid gap-2 sm:col-span-2">
                <Label>Account</Label>
                <Select value={manualTransactionForm.financeAccountId} onValueChange={(value) => setManualTransactionForm((prev) => ({ ...prev, financeAccountId: value }))}>
                  <SelectTrigger className="min-h-11"><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>{account.accountName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={manualTransactionForm.amount} onChange={(e) => setManualTransactionForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            {manualTransactionForm.transactionType !== 'internal_transfer' ? (
              <div className="sm:col-span-2">
                <FinanceTagFields
                  value={manualTransactionForm.tags}
                  onChange={(tags) => setManualTransactionForm((prev) => ({ ...prev, tags }))}
                  direction={manualTransactionForm.transactionType === 'manual_inflow' ? 'inflow' : 'outflow'}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label>Reference Number</Label>
              <Input value={manualTransactionForm.referenceNumber} onChange={(e) => setManualTransactionForm((prev) => ({ ...prev, referenceNumber: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Counterparty</Label>
              <Input value={manualTransactionForm.counterpartyName} onChange={(e) => setManualTransactionForm((prev) => ({ ...prev, counterpartyName: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Narrative</Label>
              <Input value={manualTransactionForm.narrative} onChange={(e) => setManualTransactionForm((prev) => ({ ...prev, narrative: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualTransaction(false)}>Cancel</Button>
            <Button onClick={handleCreateManualTransaction} disabled={createManualTransactionMutation.isPending}>
              {createManualTransactionMutation.isPending ? 'Saving...' : 'Record Movement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateAllocation} onOpenChange={setShowCreateAllocation}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Allocate Petty Cash</DialogTitle>
            <DialogDescription>
              Move funds into a petty cash account and assign responsibility to a farm manager for later justification review.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Source Account</Label>
              <Select value={allocationForm.sourceFinanceAccountId} onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, sourceFinanceAccountId: value }))}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Select source account" /></SelectTrigger>
                <SelectContent>
                  {liquidAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>{account.accountName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Petty Cash Account</Label>
              <Select value={allocationForm.pettyCashAccountId} onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, pettyCashAccountId: value }))}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Select petty cash account" /></SelectTrigger>
                <SelectContent>
                  {pettyCashAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>{account.accountName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Farm Manager</Label>
              <Select value={allocationForm.allocatedToUserId} onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, allocatedToUserId: value }))}>
                <SelectTrigger className="min-h-11"><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={String(manager.id)}>
                      {manager.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Allocation Date</Label>
              <Input type="date" value={allocationForm.allocationDate} onChange={(e) => setAllocationForm((prev) => ({ ...prev, allocationDate: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={allocationForm.amount} onChange={(e) => setAllocationForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Purpose</Label>
              <Input value={allocationForm.purpose} onChange={(e) => setAllocationForm((prev) => ({ ...prev, purpose: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAllocation(false)}>Cancel</Button>
            <Button onClick={handleCreatePettyCashAllocation} disabled={createAllocationMutation.isPending}>
              {createAllocationMutation.isPending ? 'Allocating...' : 'Allocate Cash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit Petty Cash Expense</DialogTitle>
            <DialogDescription>
              Record how the allocated petty cash was used. An admin review is required before the expense posts into treasury.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Expense Date</Label>
              <Input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm((prev) => ({ ...prev, expenseDate: e.target.value }))} />
            </div>
            <FinanceTagFields
              value={expenseForm.tags}
              onChange={(tags) => setExpenseForm((prev) => ({ ...prev, tags }))}
              direction="outflow"
              showBatch={false}
              required={false}
              categoryLabel="Category *"
            />
            <p className="-mt-2 text-xs text-muted-foreground">Leave the cost centre blank to charge it to the manager's farm.</p>
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Justification</Label>
              <Input value={expenseForm.justification} onChange={(e) => setExpenseForm((prev) => ({ ...prev, justification: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateExpense} disabled={createExpenseMutation.isPending || !selectedAllocationId || !expenseForm.tags.categoryId}>
              {createExpenseMutation.isPending ? 'Submitting...' : 'Submit Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTransactionId} onOpenChange={(open) => !open && setSelectedTransactionId(undefined)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Treasury Transaction</DialogTitle>
            <DialogDescription>
              View the account entries and source links behind this money movement.
            </DialogDescription>
          </DialogHeader>

          {transactionDetailQuery.isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : transactionDetailQuery.data?.data ? (
            <div className="space-y-5">
              <Card className="border-border/70">
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p>
                    <p className="mt-1 font-semibold">{transactionDetailQuery.data.data.transaction.transactionCode}</p>
                    <p className="text-sm text-muted-foreground">{transactionDetailQuery.data.data.transaction.referenceNumber ?? '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Counterparty</p>
                    <p className="mt-1 font-semibold">{transactionDetailQuery.data.data.transaction.counterpartyNameSnapshot ?? '--'}</p>
                    <p className="text-sm text-muted-foreground">
                      {TRANSACTION_TYPE_LABELS[transactionDetailQuery.data.data.transaction.transactionType] ?? transactionDetailQuery.data.data.transaction.transactionType}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                    <p className="mt-1">{new Date(String(transactionDetailQuery.data.data.transaction.transactionDate)).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="mt-1"><StatusBadge status={transactionDetailQuery.data.data.transaction.status} /></div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Account Entries</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {transactionDetailQuery.data.data.entries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{entry.accountName ?? entry.accountCode}</p>
                          <p className="text-xs text-muted-foreground">
                            {[entry.categoryName, entry.costCentreName, entry.batchCode].filter(Boolean).join(' · ') || (entry.accountCode ?? '--')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${entry.entryDirection === 'inflow' ? 'text-success' : 'text-danger'}`}>
                            {entry.entryDirection === 'inflow' ? '+' : '-'}{formatCurrency(Number(entry.amount))}
                          </p>
                          <p className="text-xs text-muted-foreground">{new Date(entry.valueDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Source Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {transactionDetailQuery.data.data.links.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No source links recorded for this movement.</p>
                    ) : transactionDetailQuery.data.data.links.map((link) => (
                      <div key={link.id} className="rounded-lg border border-border/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium capitalize">{link.sourceEntityType.replace(/_/g, ' ')}</p>
                          {link.allocatedAmount ? <p className="text-sm font-medium">{formatCurrency(Number(link.allocatedAmount))}</p> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {link.sourceCodeSnapshot ?? `${link.sourceModule}:${link.sourceEntityId}`}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <EmptyState title="Transaction not found" description="The selected treasury transaction could not be loaded." />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Landmark;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-muted p-2.5">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageTile({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function ErrorBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-warning/30 bg-warning-soft">
      <CardContent className="flex items-start gap-3 p-4">
        <CircleAlert className="mt-0.5 h-5 w-5 text-warning" />
        <div>
          <p className="font-medium text-warning">{title}</p>
          <p className="mt-1 text-sm text-warning">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InlineErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-4 w-4 text-warning" />
        <p className="text-sm text-warning">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-background p-3 shadow-sm">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-4 min-h-11 gap-2" onClick={onAction}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function AttentionChip({ tone, onClick, children }: { tone: 'info' | 'warning' | 'danger'; onClick: () => void; children: ReactNode }) {
  const tones = { info: 'bg-info-soft text-info', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' };
  return (
    <button type="button" onClick={onClick} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tones[tone]}`}>
      {children}
    </button>
  );
}
