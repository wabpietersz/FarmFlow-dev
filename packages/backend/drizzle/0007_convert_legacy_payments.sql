-- Move old-style sale payments onto buyer receipts so every money-in record lives in one place.
-- Only sales with no receipt allocations are converted: for the others the app already ignored
-- the old rows (receipts took precedence), so converting them would double count.
-- Converted lines are NOT posted to the money ledger: they predate it, same as before.
DO $$
DECLARE
  p RECORD;
  new_receipt_id integer;
  new_line_id integer;
BEGIN
  FOR p IN
    SELECT pay.*, s.buyer_id
    FROM payments pay
    JOIN sales s ON s.id = pay.sale_id
    WHERE NOT EXISTS (SELECT 1 FROM buyer_receipt_allocations a WHERE a.sale_id = pay.sale_id)
    ORDER BY pay.payment_date, pay.id
  LOOP
    INSERT INTO buyer_receipts (receipt_code, buyer_id, receipt_date, notes, recorded_by, created_at, updated_at)
    VALUES ('RCT-LEGACY-' || p.id, p.buyer_id, p.payment_date, 'Converted from old payment #' || p.id, p.recorded_by, p.created_at, p.updated_at)
    RETURNING id INTO new_receipt_id;

    INSERT INTO buyer_receipt_lines (receipt_id, line_sequence, payment_amount, payment_method, cheque_number, cheque_date, bank_name, payment_status, notes, created_at, updated_at)
    VALUES (new_receipt_id, 1, p.payment_amount, p.payment_method, p.cheque_number, p.cheque_date, p.bank_name, p.payment_status, p.notes, p.created_at, p.updated_at)
    RETURNING id INTO new_line_id;

    INSERT INTO buyer_receipt_allocations (receipt_line_id, sale_id, allocated_amount, created_at, updated_at)
    VALUES (new_line_id, p.sale_id, p.payment_amount, p.created_at, p.updated_at);
  END LOOP;
END $$;
