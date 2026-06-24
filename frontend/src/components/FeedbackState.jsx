import { Button, MessageBar, MessageBarBody, MessageBarTitle, Skeleton, SkeletonItem } from './bootstrap-ui';
import { ArrowClockwise24Regular, Search24Regular } from './bootstrap-icons';

export function LoadingState({ rows = 5 }) {
  return (
    <div className="loading-state" aria-label="Đang tải dữ liệu">
      <Skeleton>
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonItem key={index} shape="rectangle" className="loading-state__row" />
        ))}
      </Skeleton>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <MessageBar intent="error" className="feedback-message">
      <MessageBarBody>
        <MessageBarTitle>Chưa tải được dữ liệu</MessageBarTitle>
        {message}
      </MessageBarBody>
      {onRetry && <Button appearance="subtle" icon={<ArrowClockwise24Regular />} onClick={onRetry}>Thử lại</Button>}
    </MessageBar>
  );
}

export function EmptyState({ title = 'Chưa có dữ liệu', description = 'Dữ liệu mới sẽ xuất hiện tại đây.' }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Search24Regular /></span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
