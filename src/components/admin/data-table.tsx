import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { TableSkeleton } from "./loading";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Accessor function or property name. */
  accessor?: (row: T) => ReactNode;
  /** Allow sorting on this column (controlled via `sort`/`onSortChange`). */
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  width?: string | number;
  align?: "left" | "center" | "right";
};

export type Sort = { key: string; dir: "asc" | "desc" } | null;

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  sort?: Sort;
  onSortChange?: (sort: Sort) => void;
  onRowClick?: (row: T) => void;
  selection?: {
    selected: string[];
    onChange: (ids: string[]) => void;
  };
  actions?: (row: T) => ReactNode;
  className?: string;
  stickyHeader?: boolean;
};

const alignCls = { left: "text-left", center: "text-center", right: "text-right" } as const;

export function DataTable<T>({
  columns, rows, rowKey, loading, error, onRetry, empty,
  sort, onSortChange, onRowClick, selection, actions, className, stickyHeader,
}: DataTableProps<T>) {
  if (loading) return <TableSkeleton rows={6} cols={columns.length + (selection ? 1 : 0) + (actions ? 1 : 0)} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!rows.length) return empty ?? <EmptyState />;

  const allSelected = !!selection && rows.length > 0 && rows.every((r) => selection.selected.includes(rowKey(r)));
  const someSelected = !!selection && rows.some((r) => selection.selected.includes(rowKey(r))) && !allSelected;

  const toggleAll = () => {
    if (!selection) return;
    if (allSelected) {
      selection.onChange(selection.selected.filter((id) => !rows.some((r) => rowKey(r) === id)));
    } else {
      const ids = new Set([...selection.selected, ...rows.map(rowKey)]);
      selection.onChange(Array.from(ids));
    }
  };
  const toggleOne = (id: string) => {
    if (!selection) return;
    if (selection.selected.includes(id)) selection.onChange(selection.selected.filter((x) => x !== id));
    else selection.onChange([...selection.selected, id]);
  };

  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (!sort || sort.key !== col.key) return onSortChange({ key: col.key, dir: "asc" });
    if (sort.dir === "asc") return onSortChange({ key: col.key, dir: "desc" });
    onSortChange(null);
  };

  return (
    <div className={cn("rounded-md border bg-card overflow-x-auto", className)}>
      <Table>
        <TableHeader className={stickyHeader ? "sticky top-0 z-10 bg-card" : undefined}>
          <TableRow>
            {selection && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected || (someSelected && "indeterminate")}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
            )}
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <TableHead
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(col.headerClassName, col.align && alignCls[col.align], col.sortable && "cursor-pointer select-none")}
                  onClick={() => handleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      active
                        ? (sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
                        : <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </TableHead>
              );
            })}
            {actions && <TableHead className="w-12 text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = rowKey(row);
            const isSelected = !!selection?.selected.includes(id);
            return (
              <TableRow
                key={id}
                data-state={isSelected ? "selected" : undefined}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-no-row-click]")) return;
                  onRowClick?.(row);
                }}
              >
                {selection && (
                  <TableCell data-no-row-click>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(id)} aria-label="Selecionar linha" />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.key} className={cn(col.className, col.align && alignCls[col.align])}>
                    {col.accessor ? col.accessor(row) : (row as Record<string, ReactNode>)[col.key]}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className="text-right" data-no-row-click>
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
