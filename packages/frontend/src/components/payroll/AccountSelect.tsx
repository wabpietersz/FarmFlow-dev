import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTreasuryAccounts } from '@/hooks/useTreasury';

/** Active money accounts (bank, cash…) to pay from or into. */
export function AccountSelect({ value, onChange, id, cashOnly }: { value: string; onChange: (value: string) => void; id?: string; cashOnly?: boolean }) {
  const accounts = (useTreasuryAccounts().data?.data ?? []).filter((a) => a.status === 'active' && (!cashOnly || a.accountType === 'cash' || a.accountType === 'petty_cash'));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}><SelectValue placeholder="Choose account" /></SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={String(account.id)}>{account.accountName}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
