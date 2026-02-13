import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Sri Lankan Rupees: Rs. 1,234.56 */
export const formatCurrency = (v: number) =>
  `Rs. ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Abbreviated currency for chart axes: Rs. 125k */
export const formatCurrencyCompact = (v: number) =>
  `Rs. ${(v / 1000).toFixed(0)}k`;
