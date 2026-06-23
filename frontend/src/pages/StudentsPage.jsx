import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow,
} from '@fluentui/react-components';
import { Add24Regular, Search24Regular } from '@fluentui/react-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { usePageData } from '../hooks/usePageData';
import { formatDate } from '../utils/format';

const initialForm = { student_code: '', full_name: '', date_of_birth: '', gender: '', phone: '', email: '', school_name: '', grade_level: '', status: 'active' };

export default function StudentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const canManage = ['admin', 'staff'].includes(user.role);

  const { data, loading, error, refresh } = usePageData(
    () => api.get(`/students?page=${page}&limit=10&search=${encodeURIComponent(search)}`).then((response) => response.data),
    [page, search],
  );

  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function createStudent(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/students', Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '')));
      setDialogOpen(false);
      setForm(initialForm);
      setPage(1);
      refresh();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="page-flow">
      <PageHeader title="Học sinh" description="Theo dõi hồ sơ và tình trạng học tập của từng bạn." action={canManage && <Button appearance="primary" icon={<Add24Regular />} onClick={() => setDialogOpen(true)}>Thêm học sinh</Button>} />
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <Input aria-label="Tìm học sinh" contentBefore={<Search24Regular />} placeholder="Tìm theo tên, mã hoặc số điện thoại" value={searchInput} onChange={(_, dataValue) => setSearchInput(dataValue.value)} />
        <Button type="submit" appearance="secondary">Tìm kiếm</Button>
      </form>

      {loading && <LoadingState rows={7} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && <EmptyState title="Chưa tìm thấy học sinh" description="Thử từ khóa khác hoặc thêm hồ sơ học sinh mới." />}
      {data?.items.length > 0 && (
        <div className="table-surface">
          <Table aria-label="Danh sách học sinh">
            <TableHeader><TableRow><TableHeaderCell>Học sinh</TableHeaderCell><TableHeaderCell>Liên hệ</TableHeaderCell><TableHeaderCell>Trường và khối</TableHeaderCell><TableHeaderCell>Ngày sinh</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell></TableRow></TableHeader>
            <TableBody>{data.items.map((student) => (
              <TableRow key={student.student_id}>
                <TableCell><div className="primary-cell"><span className="initial-tile">{student.full_name.slice(0, 1)}</span><div><strong>{student.full_name}</strong><span>{student.student_code}</span></div></div></TableCell>
                <TableCell><div className="stacked-cell"><span>{student.phone || 'Chưa có số điện thoại'}</span><small>{student.email || 'Chưa có email'}</small></div></TableCell>
                <TableCell><div className="stacked-cell"><span>{student.school_name || 'Chưa cập nhật trường'}</span><small>{student.grade_level || 'Chưa cập nhật khối'}</small></div></TableCell>
                <TableCell>{formatDate(student.date_of_birth)}</TableCell>
                <TableCell><StatusBadge status={student.status} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => setDialogOpen(details.open)}>
        <DialogSurface><form onSubmit={createStudent}><DialogBody><DialogTitle>Thêm học sinh mới</DialogTitle><DialogContent className="form-grid">
          {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
          <Field label="Mã học sinh" required><Input value={form.student_code} onChange={(_, dataValue) => updateField('student_code', dataValue.value)} placeholder="S004" /></Field>
          <Field label="Họ và tên" required><Input value={form.full_name} onChange={(_, dataValue) => updateField('full_name', dataValue.value)} /></Field>
          <Field label="Ngày sinh"><Input type="date" value={form.date_of_birth} onChange={(_, dataValue) => updateField('date_of_birth', dataValue.value)} /></Field>
          <Field label="Giới tính"><Select value={form.gender} onChange={(event) => updateField('gender', event.target.value)}><option value="">Chọn giới tính</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></Select></Field>
          <Field label="Số điện thoại"><Input value={form.phone} onChange={(_, dataValue) => updateField('phone', dataValue.value)} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(_, dataValue) => updateField('email', dataValue.value)} /></Field>
          <Field label="Trường học"><Input value={form.school_name} onChange={(_, dataValue) => updateField('school_name', dataValue.value)} /></Field>
          <Field label="Khối lớp"><Input value={form.grade_level} onChange={(_, dataValue) => updateField('grade_level', dataValue.value)} placeholder="Grade 9" /></Field>
        </DialogContent><DialogActions><Button appearance="secondary" onClick={() => setDialogOpen(false)}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || !form.student_code || !form.full_name}>{saving ? 'Đang lưu...' : 'Lưu học sinh'}</Button></DialogActions></DialogBody></form></DialogSurface>
      </Dialog>
    </div>
  );
}
