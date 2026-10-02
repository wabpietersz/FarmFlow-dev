import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, DollarSign, FileText, Wallet } from 'lucide-react';
import { useBuyer } from '@/hooks/useSales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { RowActions } from '@/components/ui/row-actions';
import { StatusBadge } from '@/components/ui/status-badge';

export default function BuyerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useBuyer(id);

  const buyerData = data?.data;
  const buyer = buyerData?.buyer;
  const summary = buyerData?.summary;
  const salesHistory = buyerData?.salesHistory ?? [];
  const receipts = buyerData?.receipts ?? [];
  const ledger = buyerData?.ledger ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!buyer || !summary) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Buyer not found</h3>
        <Button asChild variant="outline" className="mt-4"><Link to="/sales">Back to Sales</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon"><Link to="/sales"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{buyer.buyerName}</h1>
          <p className="text-sm text-muted-foreground">{buyer.contactPerson ?? 'No contact person'} | {buyer.phoneNumber ?? 'No phone'}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-info" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(summary.totalReceiptsCompleted)}</p>
                <p className="text-xs text-muted-foreground">Receipts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-danger" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(summary.outstandingBalance)}</p>
                <p className="text-xs text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(summary.advanceCredit)}</p>
                <p className="text-xs text-muted-foreground">Advance Credit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Running Ledger</CardTitle></CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No ledger activity recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Running Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.entryDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{entry.referenceCode}</TableCell>
                    <TableCell className="capitalize">{entry.entryType}</TableCell>
                    <TableCell>{entry.debit > 0 ? formatCurrency(entry.debit) : '--'}</TableCell>
                    <TableCell>{entry.credit > 0 ? formatCurrency(entry.credit) : '--'}</TableCell>
                    <TableCell className={entry.runningBalance > 0 ? 'text-danger font-medium' : 'text-success font-medium'}>
                      {formatCurrency(Math.abs(entry.runningBalance))} {entry.runningBalance > 0 ? 'due' : 'credit'}
                    </TableCell>
                    <TableCell className="capitalize">{entry.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales</CardTitle></CardHeader>
          <CardContent>
            {salesHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales found for this buyer.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableActionsHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesHistory.map((sale) => (
                    <TableRow key={sale.id} onOpen={() => navigate(`/sales/${sale.id}`)}>
                      <TableCell className="font-semibold">{sale.saleCode}</TableCell>
                      <TableCell>{new Date(sale.saleDate).toLocaleDateString()}</TableCell>
                      <TableCell>{formatCurrency(Number(sale.totalAmount))}</TableCell>
                      <TableCell>{formatCurrency(sale.outstandingBalance ?? 0)}</TableCell>
                      <TableActionsCell><RowActions label={`sale ${sale.saleCode}`} open={`/sales/${sale.id}`} /></TableActionsCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Receipts</CardTitle></CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No receipts found for this buyer.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Treasury</TableHead>
                    <TableHead>Cheque #</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Unapplied</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell>{new Date(receipt.receiptDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{receipt.receiptCode}</TableCell>
                      <TableCell>{formatCurrency(receipt.paymentAmount)}</TableCell>
                      <TableCell className="capitalize">{receipt.paymentMethod.replace('_', ' ')}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="space-y-1">
                          <p>{receipt.financeAccountName || (receipt.financeAccountId ? `Account #${receipt.financeAccountId}` : '--')}</p>
                          {receipt.treasuryTransactionId ? <p>Txn #{receipt.treasuryTransactionId}</p> : null}
                          {receipt.treasuryReversalTransactionId ? <p>Reversal #{receipt.treasuryReversalTransactionId}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell>{receipt.chequeNumber ?? '--'}</TableCell>
                      <TableCell>{formatCurrency(receipt.appliedAmount)}</TableCell>
                      <TableCell>{formatCurrency(receipt.unappliedAmount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={receipt.paymentStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
