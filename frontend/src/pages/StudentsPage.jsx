import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow, Textarea,
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Edit24Regular, Search24Regular } from '@fluentui/react-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { usePageData } from '../hooks/usePageData';
import { formatDate } from '../utils/format';

const initialForm = {
  student_code: '', full_name: '', date_of_birth: '', gender: '', phone: '', email: '',
  address: '', school_name: '', grade_level: '', status: 'active', note: '',
};

function studentToForm(student) {
  return {
    ...initialForm,
    ...Object.fromEntries(Object.keys(initialForm).map((field) => [field, student[field] ?? ''])),
    date_of_birth: student.date_of_birth ? String(student.date_of_birth).slice(0, 10) : '',
  };
}

export default function StudentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const canCreate = ['admin', 'staff'].includes(user.role);
  const canEdit = ['admin', 'staff', 'teacher'].includes(user.role);
  const canDelete = ['admin', 'staff'].includes(user.role);

  const { data, loading, error, refresh } = usePageData(
    () => api.get(`/students?page=${page}&limit=10&search=${encodeURIComponent(search)}`).then((response) => response.data),
    [page, search],
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateDialog() {
    setEditingStudent(null);
    setForm(initialForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(student) {
    setEditingStudent(student);
    setForm(studentToForm(student));
    setFormError('');
    setDialogOpen(true);
  }

  function closeStudentDialog(force = false) {
    if (saving && !force) return;
    setDialogOpen(false);
    setEditingStudent(null);
    setForm(initialForm);
    setFormError('');
  }

  async function saveStudent(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = Object.fromEntries(
      Object.entries(form).map(([field, value]) => [field, value === '' ? null : value]),
    );
    try {
      if (editingStudent) await api.put(`/students/${editingStudent.student_id}`, payload);
      else await api.post('/students', payload);
      closeStudentDialog(true);
      if (!editingStudent) setPage(1);
      refresh();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function askToDelete(student) {
    setDeleteTarget(student);
    setDeleteError('');
  }

  async function deleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/students/${deleteTarget.student_id}`);
      setDeleteTarget(null);
      if (data.items.length === 1 && page > 1) setPage((current) => current - 1);
      else refresh();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-flow">
      <PageHeader
        title="Học sinh"
        description="Theo dõi hồ sơ và tình trạng học tập của từng bạn."
        action={canCreate && <Button appearance="primary" icon={<Add24Regular />} onClick={openCreateDialog}>Thêm học sinh</Button>}
      />
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <Input aria-label="Tìm học sinh" contentBefore={<Search24Regular />} placeholder="Tìm theo tên, mã hoặc số điện thoại" value={searchInput} onChange={(_, dataValue) => setSearchInput(dataValue.value)} />
        <Button type="submit" appearance="secondary">Tìm kiếm</Button>
      </form>

      {loading && <LoadingState rows={7} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && <EmptyState title="Chưa tìm thấy học sinh" description={canCreate ? 'Thử từ khóa khác hoặc thêm hồ sơ học sinh mới.' : 'Thử từ khóa khác hoặc kiểm tra lại danh sách lớp được phân công.'} />}
      {data?.items.length > 0 && (
        <div className="table-surface student-table">
          <Table aria-label="Danh sách học sinh">
            <TableHeader><TableRow>
              <TableHeaderCell>Học sinh</TableHeaderCell>
              <TableHeaderCell>Liên hệ</TableHeaderCell>
              <TableHeaderCell>Trường và khối</TableHeaderCell>
              <TableHeaderCell>Ngày sinh</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              {(canEdit || canDelete) && <TableHeaderCell>Thao tác</TableHeaderCell>}
            </TableRow></TableHeader>
            <TableBody>{data.items.map((student) => (
              <TableRow key={student.student_id}>
                <TableCell><div className="primary-cell"><span className="initial-tile">{student.full_name.slice(0, 1)}</span><div><strong>{student.full_name}</strong><span>{student.student_code}</span></div></div></TableCell>
                <TableCell><div className="stacked-cell"><span>{student.phone || 'Chưa có số điện thoại'}</span><small>{student.email || 'Chưa có email'}</small></div></TableCell>
                <TableCell><div className="stacked-cell"><span>{student.school_name || 'Chưa cập nhật trường'}</span><small>{student.grade_level || 'Chưa cập nhật khối'}</small></div></TableCell>
                <TableCell>{formatDate(student.date_of_birth)}</TableCell>
                <TableCell><StatusBadge status={student.status} /></TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="student-actions">
                      {canEdit && <Button appearance="subtle" size="small" icon={<Edit24Regular />} aria-label={`Sửa ${student.full_name}`} title="Chỉnh sửa" onClick={() => openEditDialog(student)} />}
                      {canDelete && <Button appearance="subtle" size="small" icon={<Delete24Regular />} aria-label={`Xóa ${student.full_name}`} title="Xóa học sinh" onClick={() => askToDelete(student)} />}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => { if (!details.open) closeStudentDialog(); }}>
        <DialogSurface className="student-dialog"><form onSubmit={saveStudent}><DialogBody>
          <DialogTitle>{editingStudent ? `Chỉnh sửa ${editingStudent.full_name}` : 'Thêm học sinh mới'}</DialogTitle>
          <DialogContent className="form-grid student-form">
            {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
            <Field label="Mã học sinh" required><Input value={form.student_code} onChange={(_, dataValue) => updateField('student_code', dataValue.value)} placeholder="S004" /></Field>
            <Field label="Họ và tên" required><Input value={form.full_name} onChange={(_, dataValue) => updateField('full_name', dataValue.value)} /></Field>
            <Field label="Ngày sinh"><Input type="date" value={form.date_of_birth} onChange={(_, dataValue) => updateField('date_of_birth', dataValue.value)} /></Field>
            <Field label="Giới tính"><Select value={form.gender} onChange={(event) => updateField('gender', event.target.value)}><option value="">Chọn giới tính</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></Select></Field>
            <Field label="Số điện thoại"><Input value={form.phone} onChange={(_, dataValue) => updateField('phone', dataValue.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(_, dataValue) => updateField('email', dataValue.value)} /></Field>
            <Field label="Trường học"><Input value={form.school_name} onChange={(_, dataValue) => updateField('school_name', dataValue.value)} /></Field>
            <Field label="Khối lớp"><Input value={form.grade_level} onChange={(_, dataValue) => updateField('grade_level', dataValue.value)} placeholder="Khối 9" /></Field>
            <Field label="Trạng thái"><Select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="paused">Tạm nghỉ</option><option value="graduated">Đã tốt nghiệp</option></Select></Field>
            <Field label="Địa chỉ"><Input value={form.address} onChange={(_, dataValue) => updateField('address', dataValue.value)} /></Field>
            <Field className="form-grid__wide" label="Ghi chú"><Textarea resize="vertical" value={form.note} onChange={(_, dataValue) => updateField('note', dataValue.value)} /></Field>
          </DialogContent>
          <DialogActions><Button type="button" appearance="secondary" disabled={saving} onClick={() => closeStudentDialog()}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || !form.student_code.trim() || !form.full_name.trim()}>{saving ? 'Đang lưu...' : editingStudent ? 'Lưu thay đổi' : 'Lưu học sinh'}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, details) => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <DialogSurface><DialogBody>
          <DialogTitle>Xóa hồ sơ học sinh?</DialogTitle>
          <DialogContent>
            {deleteError && <MessageBar intent="error"><MessageBarBody>{deleteError}</MessageBarBody></MessageBar>}
            <p className="delete-confirmation">Hồ sơ của <strong>{deleteTarget?.full_name}</strong> và các dữ liệu liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.</p>
          </DialogContent>
          <DialogActions><Button appearance="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button><Button className="danger-button" appearance="primary" disabled={deleting} onClick={deleteStudent}>{deleting ? 'Đang xóa...' : 'Xóa học sinh'}</Button></DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </div>
  );
}
