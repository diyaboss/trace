import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination as PageInfo } from '../api/types';
import { PAGE_SIZES } from '../lib/incidentQuery';
import { Button } from './ui/Button';
import { fieldStyles } from './ui/Field';
import styles from './Pagination.module.css';

interface PaginationProps {
  info: PageInfo;
  disabled?: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

export function Pagination({ info, disabled, onPage, onPageSize }: PaginationProps) {
  const first = info.total === 0 ? 0 : (info.page - 1) * info.page_size + 1;
  const last = Math.min(info.page * info.page_size, info.total);
  const hasNext = info.page * info.page_size < info.total;
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <p className={`${styles.range} tabular`}>
        Showing {first}–{last} of {info.total}
      </p>
      <label className={styles.size}>
        <span>Rows per page</span>
        <select
          className={`${fieldStyles.control} ${styles.select}`}
          value={info.page_size}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          icon={<ChevronLeft aria-hidden="true" />}
          disabled={disabled || info.page <= 1}
          onClick={() => onPage(info.page - 1)}
        >
          Previous
        </Button>
        <Button variant="secondary" disabled={disabled || !hasNext} onClick={() => onPage(info.page + 1)}>
          Next
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
