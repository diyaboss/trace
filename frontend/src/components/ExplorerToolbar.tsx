import { Columns3, RefreshCw, Table2 } from 'lucide-react';
import type { ColumnDef } from './DataTable';
import { Button } from './ui/Button';
import { Popover } from './ui/Popover';
import styles from './ExplorerToolbar.module.css';

interface ExplorerToolbarProps<Row> {
  tableLabel: string;
  tableName: string;
  columns: ColumnDef<Row>[];
  hidden: ReadonlySet<string>;
  onToggleColumn: (key: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * The table selector lists only tables that actually work. In the Incident
 * slice that is Incidents alone, so it is shown as the current table rather
 * than as a menu of one.
 */
export function ExplorerToolbar<Row>({
  tableLabel,
  tableName,
  columns,
  hidden,
  onToggleColumn,
  onRefresh,
  refreshing,
}: ExplorerToolbarProps<Row>) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.table} aria-label={`Current table: ${tableLabel}`} role="group">
        <Table2 aria-hidden="true" />
        <span className={styles.tableLabel}>{tableLabel}</span>
        <span className={`${styles.tableName} mono`}>{tableName}</span>
      </div>
      <div className={styles.tools}>
        <Popover
          label="Visible columns"
          align="end"
          trigger={(props) => (
            <Button variant="secondary" icon={<Columns3 aria-hidden="true" />} {...props}>
              Columns
            </Button>
          )}
        >
          {() => (
            <fieldset className={styles.columns}>
              <legend className={styles.columnsLegend}>Visible columns</legend>
              {columns.map((column) => (
                <label key={column.key} className={styles.check} data-locked={column.alwaysVisible || undefined}>
                  <input
                    type="checkbox"
                    checked={column.alwaysVisible || !hidden.has(column.key)}
                    disabled={column.alwaysVisible}
                    onChange={() => onToggleColumn(column.key)}
                  />
                  <span>{column.label}</span>
                  {column.alwaysVisible ? <span className={styles.lockNote}>Always shown</span> : null}
                </label>
              ))}
            </fieldset>
          )}
        </Popover>
        <Button
          variant="secondary"
          icon={<RefreshCw aria-hidden="true" className={refreshing ? styles.spinning : undefined} />}
          onClick={onRefresh}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
