import { Button } from '@fluentui/react-components';
import { ChevronLeft24Regular, ChevronRight24Regular } from '@fluentui/react-icons';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total <= pagination.limit) return null;
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  return (
    <div className="pagination" aria-label="Phân trang">
      <span>Trang {pagination.page} / {totalPages}</span>
      <div>
        <Button appearance="subtle" icon={<ChevronLeft24Regular />} aria-label="Trang trước" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} />
        <Button appearance="subtle" icon={<ChevronRight24Regular />} aria-label="Trang sau" disabled={pagination.page >= totalPages} onClick={() => onPageChange(pagination.page + 1)} />
      </div>
    </div>
  );
}
