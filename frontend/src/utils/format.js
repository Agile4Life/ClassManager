const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat('vi-VN');

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return 'Chưa cập nhật';
  return dateFormatter.format(new Date(value));
}

export function formatTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

export const dayLabels = {
  monday: 'Thứ hai', tuesday: 'Thứ ba', wednesday: 'Thứ tư', thursday: 'Thứ năm',
  friday: 'Thứ sáu', saturday: 'Thứ bảy', sunday: 'Chủ nhật',
};
