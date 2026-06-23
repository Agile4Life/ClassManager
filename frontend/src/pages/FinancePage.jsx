import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Tab, TabList, Table, TableBody,
  TableCell, TableHeader, TableHeaderCell, TableRow,
} from '@fluentui/react-components';
import { Add24Regular } from '@fluentui/react-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { usePageData } from '../hooks/usePageData';
import { formatCurrency, formatDate } from '../utils/format';

const currentDate = new Date();
const initialForm = { student_id: '', class_id: '', invoice_month: String(currentDate.getMonth() + 1), invoice_year: String(currentDate.getFullYear()), total_amount: '', discount_amount: '0', due_date: '' };

export default function FinancePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('invoices');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const canManage = ['admin', 'staff'].includes(user.role);

  const { data, loading, error, refresh } = usePageData(async () => {
    if (canManage) {
      const [invoices, payments, students, classes] = await Promise.all([api.get(`/invoices?page=${page}&limit=10`), api.get(`/payments?page=${page}&limit=10`), api.get('/students?limit=100'), api.get('/classes?limit=100')]);
      return { invoices: invoices.data, payments: payments.data, students: students.data.items, classes: classes.data.items };
    }
    if (user.role === 'student') {
      const [invoices, payments] = await Promise.all([api.get(`/students/${user.student_id}/invoices`), api.get(`/students/${user.student_id}/payments`)]);
      return { invoices: { items: invoices.data }, payments: { items: payments.data }, students: [], classes: [] };
    }
    const timetable = await api.get(`/timetable/parent/${user.parent_id}`);
    const studentIds = [...new Set(timetable.data.map((item) => item.student_id))];
    const invoiceResponses = await Promise.all(studentIds.map((id) => api.get(`/students/${id}/invoices`)));
    const paymentResponses = await Promise.all(studentIds.map((id) => api.get(`/students/${id}/payments`)));
    return { invoices: { items: invoiceResponses.flatMap((item) => item.data) }, payments: { items: paymentResponses.flatMap((item) => item.data) }, students: [], classes: [] };
  }, [user.role, page]);

  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  async function createInvoice(event) {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      const payload = { ...form };
      for (const key of ['student_id', 'class_id', 'invoice_month', 'invoice_year', 'total_amount', 'discount_amount']) if (payload[key] !== '') payload[key] = Number(payload[key]);
      if (!payload.class_id) delete payload.class_id;
      if (!payload.due_date) delete payload.due_date;
      await api.post('/invoices', payload);
      setDialogOpen(false); setForm(initialForm); refresh();
    } catch (requestError) { setFormError(requestError.message); } finally { setSaving(false); }
  }

  const items = tab === 'invoices' ? data?.invoices.items : data?.payments.items;
  return <div className="page-flow">
    <PageHeader title="Học phí" description="Theo dõi hóa đơn và khoản thu với thông tin dễ kiểm tra." action={canManage && <Button appearance="primary" icon={<Add24Regular />} onClick={() => setDialogOpen(true)}>Tạo hóa đơn</Button>} />
    <TabList selectedValue={tab} onTabSelect={(_, details) => { setTab(details.value); setPage(1); }}><Tab value="invoices">Hóa đơn</Tab><Tab value="payments">Thanh toán</Tab></TabList>
    {loading && <LoadingState rows={7} />}{error && <ErrorState message={error} onRetry={refresh} />}{data && !items.length && <EmptyState title={tab === 'invoices' ? 'Chưa có hóa đơn' : 'Chưa có thanh toán'} />}
    {items?.length > 0 && <div className="table-surface">{tab === 'invoices' ? <InvoiceTable items={items} /> : <PaymentTable items={items} />}
      {canManage && <Pagination pagination={tab === 'invoices' ? data.invoices.pagination : data.payments.pagination} onPageChange={setPage} />}
    </div>}

    <Dialog open={dialogOpen} onOpenChange={(_, details) => setDialogOpen(details.open)}><DialogSurface><form onSubmit={createInvoice}><DialogBody><DialogTitle>Tạo hóa đơn học phí</DialogTitle><DialogContent className="form-grid">
      {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
      <Field label="Học sinh" required><Select value={form.student_id} onChange={(event) => updateField('student_id', event.target.value)}><option value="">Chọn học sinh</option>{data?.students.map((item) => <option key={item.student_id} value={item.student_id}>{item.student_code} - {item.full_name}</option>)}</Select></Field>
      <Field label="Lớp học"><Select value={form.class_id} onChange={(event) => updateField('class_id', event.target.value)}><option value="">Không gắn lớp</option>{data?.classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_code} - {item.class_name}</option>)}</Select></Field>
      <Field label="Tháng"><Input type="number" min="1" max="12" value={form.invoice_month} onChange={(_, value) => updateField('invoice_month', value.value)} /></Field><Field label="Năm"><Input type="number" min="2000" value={form.invoice_year} onChange={(_, value) => updateField('invoice_year', value.value)} /></Field>
      <Field label="Tổng học phí" required><Input type="number" min="1" value={form.total_amount} onChange={(_, value) => updateField('total_amount', value.value)} /></Field><Field label="Giảm giá"><Input type="number" min="0" value={form.discount_amount} onChange={(_, value) => updateField('discount_amount', value.value)} /></Field>
      <Field label="Hạn thanh toán"><Input type="date" value={form.due_date} onChange={(_, value) => updateField('due_date', value.value)} /></Field>
    </DialogContent><DialogActions><Button appearance="secondary" onClick={() => setDialogOpen(false)}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || !form.student_id || !form.total_amount}>{saving ? 'Đang tạo...' : 'Tạo hóa đơn'}</Button></DialogActions></DialogBody></form></DialogSurface></Dialog>
  </div>;
}

function InvoiceTable({ items }) {
  return <Table aria-label="Danh sách hóa đơn"><TableHeader><TableRow><TableHeaderCell>Học sinh</TableHeaderCell><TableHeaderCell>Kỳ học phí</TableHeaderCell><TableHeaderCell>Phải thu</TableHeaderCell><TableHeaderCell>Đã thu</TableHeaderCell><TableHeaderCell>Hạn thanh toán</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.invoice_id}><TableCell><div className="stacked-cell"><strong>{item.student_name || `Học sinh #${item.student_id}`}</strong><small>{item.class_name || 'Không gắn lớp'}</small></div></TableCell><TableCell>Tháng {item.invoice_month}/{item.invoice_year}</TableCell><TableCell>{formatCurrency(item.final_amount)}</TableCell><TableCell>{formatCurrency(item.paid_amount)}</TableCell><TableCell>{formatDate(item.due_date)}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></TableRow>)}</TableBody></Table>;
}

function PaymentTable({ items }) {
  return <Table aria-label="Danh sách thanh toán"><TableHeader><TableRow><TableHeaderCell>Học sinh</TableHeaderCell><TableHeaderCell>Số tiền</TableHeaderCell><TableHeaderCell>Ngày thu</TableHeaderCell><TableHeaderCell>Phương thức</TableHeaderCell><TableHeaderCell>Mã giao dịch</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.payment_id}><TableCell>{item.student_name || `Học sinh #${item.student_id}`}</TableCell><TableCell><strong>{formatCurrency(item.amount)}</strong></TableCell><TableCell>{formatDate(item.payment_date)}</TableCell><TableCell>{item.payment_method}</TableCell><TableCell>{item.transaction_code || 'Không có'}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></TableRow>)}</TableBody></Table>;
}
