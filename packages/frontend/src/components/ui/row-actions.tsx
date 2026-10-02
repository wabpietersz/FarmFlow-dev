import { Link } from 'react-router-dom';
import { ChevronRight, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  /** Navigate instead of calling onSelect */
  href?: string;
  /** Shown last, after a divider, in the danger colour */
  destructive?: boolean;
  disabled?: boolean;
  /** Leave the action out (e.g. no permission) */
  hidden?: boolean;
  /**
   * Show as a labelled button beside the menu. Only for the decision a queue table
   * exists for (Approve, Clear cheque…); everything else stays in the menu.
   */
  primary?: boolean;
}

interface RowActionsProps {
  /** What the row is, for screen readers: "Batch B-012" */
  label: string;
  /** Opens the row's details: an href, or a handler when details are a dialog */
  open?: string | (() => void);
  openLabel?: string;
  actions?: RowAction[];
}

/**
 * The one way to act on a table row.
 * - Details open by clicking the row (see TableRow `onOpen`); with nothing else to do the cell shows a chevron.
 * - Every other action lives in a single "…" menu: Open first, destructive last.
 */
export function RowActions({ label, open, openLabel = 'Open', actions = [] }: RowActionsProps) {
  const visible = actions.filter((action) => !action.hidden);
  const primary = visible.filter((action) => action.primary);
  const menu = visible.filter((action) => !action.primary);
  const normal = menu.filter((action) => !action.destructive);
  const destructive = menu.filter((action) => action.destructive);

  const primaryButtons = primary.map((action) => (
    <Button
      key={action.label}
      size="sm"
      variant="outline"
      disabled={action.disabled}
      className={action.destructive ? 'text-danger hover:text-danger' : undefined}
      onClick={action.onSelect}
    >
      {action.icon ? <action.icon /> : null}
      {action.label}
    </Button>
  ));

  if (menu.length === 0) {
    if (!open) return primaryButtons.length > 0 ? <>{primaryButtons}</> : null;
    return (
      <>
        {primaryButtons}
        {typeof open === 'string' ? (
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link to={open} aria-label={`${openLabel} ${label}`}><ChevronRight /></Link>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`${openLabel} ${label}`} onClick={open}>
            <ChevronRight />
          </Button>
        )}
      </>
    );
  }

  const item = (action: RowAction) => {
    const content = (
      <>
        {action.icon ? <action.icon /> : null}
        {action.label}
      </>
    );
    return action.href ? (
      <DropdownMenuItem key={action.label} asChild disabled={action.disabled} variant={action.destructive ? 'destructive' : 'default'}>
        <Link to={action.href}>{content}</Link>
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem key={action.label} disabled={action.disabled} variant={action.destructive ? 'destructive' : 'default'} onSelect={action.onSelect}>
        {content}
      </DropdownMenuItem>
    );
  };

  return (
    <>
      {primaryButtons}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Actions for ${label}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {open
            ? item(typeof open === 'string'
              ? { label: openLabel, icon: ChevronRight, href: open }
              : { label: openLabel, icon: ChevronRight, onSelect: open })
            : null}
          {normal.map(item)}
          {destructive.length > 0 && (normal.length > 0 || open) ? <DropdownMenuSeparator /> : null}
          {destructive.map(item)}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
