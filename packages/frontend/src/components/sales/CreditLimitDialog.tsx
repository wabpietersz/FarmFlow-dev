import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type CreditBlock = { message: string; canOverride: boolean };

/** Reads a CREDIT_LIMIT_EXCEEDED response from the API, if that's what the error is. */
export function readCreditBlock(error: unknown): CreditBlock | null {
  const data = (error as { response?: { data?: { code?: string; error?: string; canOverride?: boolean } } })?.response?.data;
  if (data?.code !== 'CREDIT_LIMIT_EXCEEDED') return null;
  return { message: data.error ?? 'This sale takes the buyer over their credit limit.', canOverride: !!data.canOverride };
}

/** Asks a sales admin for a reason before going over a buyer's credit limit. */
export function CreditLimitDialog({ block, onClose, onConfirm, pending }: {
  block: CreditBlock | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  pending?: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={!!block} onOpenChange={(open) => { if (!open) { setReason(''); onClose(); } }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Over credit limit</DialogTitle>
          <DialogDescription>{block?.message}</DialogDescription>
        </DialogHeader>
        {block?.canOverride ? (
          <div className="grid gap-2">
            <Label htmlFor="credit-reason">Reason</Label>
            <Textarea id="credit-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Paying cash on delivery tomorrow" />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setReason(''); onClose(); }}>Cancel</Button>
          {block?.canOverride ? (
            <Button disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>Save anyway</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
