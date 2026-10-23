import type { MouseEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import styles from './DataTable.module.css';

export interface ColumnDef<Row> {
  key: string;
  label: string;
  sortable?: boolean;
  /** First sort direction when this column is chosen. */
  firstOrder?: 'asc' | 'desc';
  /** Identifier/name columns cannot be hidden. */
  alwaysVisible?: boolean;
  defaultHidden?: boolean;
  /** Pins the column to the left while the table scrolls sideways. */
  sticky?: boolean;
  className?: string;
  render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  caption: string;
  columns: ColumnDef<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  sort: string;
  order: 'asc' | 'desc';
  onSort: (key: string, order: 'asc' | 'desc') => void;
  /** Row kept visually identifiable behind the drawer. */
  selectedKey?: string | number | null;
  /** Row fading out after a confirmed deletion. */
  removingKey?: string | number | null;
  onRowClick?: (row: Row) => void;
  actions?: (row: Row) => ReactNode;
  loading?: boolean;
}

/** Presentational table: receives data and callbacks, never fetches. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  order,
  onSort,
  selectedKey,
  removingKey,
  onRowClick,
  actions,
  loading,
}: DataTableProps<Row>) {
  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: Row) => {
    // Interactive children handle their own clicks; text selection is not a click.
    if ((event.target as Element).closest('a, button, input, select, label')) return;
    if (window.getSelection()?.toString()) return;
    // Focus the row's record link so focus returns there when the drawer closes.
    event.currentTarget.querySelector('a')?.focus({ preventScroll: true });
    onRowClick?.(row);
  };

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort === column.key;
              const ariaSort = active ? (order === 'asc' ? 'ascending' : 'descending') : undefined;
              const Icon = active ? (order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={[column.className, column.sticky && styles.sticky].filter(Boolean).join(' ') || undefined}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      data-active={active || undefined}
                      onClick={() => onSort(column.key, active ? (order === 'asc' ? 'desc' : 'asc') : (column.firstOrder ?? 'asc'))}
                    >
                      {column.label}
                      <Icon aria-hidden="true" className={styles.sortIcon} />
                    </button>
                  ) : (
                    <span className={styles.headLabel}>{column.label}</span>
                  )}
                </th>
              );
            })}
            {actions ? (
              <th scope="col" className={styles.actionsHead}>
                <span className="visually-hidden">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 8 }, (_, index) => (
                <tr key={index} aria-hidden="true" className={styles.skeletonRow}>
                  {columns.map((column, i) => (
                    <td key={column.key}>
                      <span className="skeleton" style={{ height: 14, width: i === 1 ? '75%' : i === 0 ? 36 : 72 }} />
                    </td>
                  ))}
                  {actions ? <td /> : null}
                </tr>
              ))
            : rows.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    className={styles.row}
                    data-selected={key === selectedKey || undefined}
                    data-removing={key === removingKey || undefined}
                    onClick={(event) => handleRowClick(event, row)}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={[column.className, column.sticky && styles.sticky].filter(Boolean).join(' ') || undefined}>
                        {column.render(row)}
                      </td>
                    ))}
                    {actions ? <td className={styles.actionsCell}>{actions(row)}</td> : null}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
