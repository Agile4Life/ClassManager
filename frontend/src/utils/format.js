export function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

export function formatTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

export const dayLabels = {
  monday: 'Thứ hai', tuesday: 'Thứ ba', wednesday: 'Thứ tư', thursday: 'Thứ năm',
  friday: 'Thứ sáu', saturday: 'Thứ bảy', sunday: 'Chủ nhật',
};
