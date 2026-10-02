"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full max-w-full overflow-x-auto overscroll-x-contain"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

/** Elements inside a row that handle their own clicks; clicking them never opens the row. */
const ROW_INTERACTIVE = 'a, button, input, select, textarea, label, [role="menu"], [role="menuitem"], [role="dialog"], [data-row-stop]'

/**
 * Pass `onOpen` when the row has a detail view: the whole row becomes the way in.
 * Pair it with <RowActions open={...}> in the last cell so keyboard users get the same route.
 */
function TableRow({
  className,
  onOpen,
  onClick,
  ...props
}: React.ComponentProps<"tr"> & { onOpen?: () => void }) {
  return (
    <tr
      data-slot="table-row"
      data-clickable={onOpen ? "" : undefined}
      className={cn(
        "hover:bg-muted/60 data-[state=selected]:bg-muted border-b border-border transition-colors",
        onOpen && "cursor-pointer",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        if (!onOpen || event.defaultPrevented) return
        if ((event.target as HTMLElement).closest(ROW_INTERACTIVE)) return
        if (window.getSelection()?.toString()) return
        onOpen()
      }}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground h-11 px-3 text-left align-middle text-[13px] font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/** Header for the actions column: always last, right-aligned, no visible label. */
function TableActionsHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <TableHead className={cn("w-px text-right", className)} {...props}>
      <span className="sr-only">Actions</span>
    </TableHead>
  )
}

/** Cell for the actions column. Put a single <RowActions> inside. */
function TableActionsCell({ className, children, ...props }: React.ComponentProps<"td">) {
  return (
    <TableCell className={cn("w-px py-1.5 text-right", className)} {...props}>
      <div className="flex items-center justify-end gap-1.5">{children}</div>
    </TableCell>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableActionsHead,
  TableActionsCell,
  TableCaption,
}
