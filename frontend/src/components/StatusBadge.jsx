import { Badge } from '@fluentui/react-components';

const labels = {
  active: 'Đang hoạt động', inactive: 'Ngừng hoạt động', paused: 'Tạm dừng', graduated: 'Đã tốt nghiệp',
  completed: 'Hoàn thành', cancelled: 'Đã hủy', studying: 'Đang học',
  unpaid: 'Chưa thanh toán', partial: 'Thanh toán một phần', paid: 'Đã thanh toán',
  available: 'Sẵn sàng', maintenance: 'Bảo trì', assigned: 'Đã giao',
  draft: 'Bản nháp', sent: 'Đã gửi', graded: 'Đã chấm', submitted: 'Đã nộp',
};

const positive = new Set(['active', 'completed', 'studying', 'paid', 'available', 'sent', 'graded']);
const warning = new Set(['paused', 'partial', 'unpaid', 'maintenance', 'assigned', 'submitted']);

export default function StatusBadge({ status }) {
  const color = positive.has(status) ? 'success' : warning.has(status) ? 'warning' : 'informative';
  return <Badge appearance="tint" color={color}>{labels[status] || status || 'Chưa cập nhật'}</Badge>;
}
