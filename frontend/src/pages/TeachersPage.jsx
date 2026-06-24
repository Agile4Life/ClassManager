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

const initialForm = {
  teacher_code: '', full_name: '', phone: '', email: '',
  address: '', specialization: '', hourly_rate: 0, status: 'active', note: '',
};

function teacherToForm(teacher) {
  return {
    ...initialForm,
    ...Object.fromEntries(Object.keys(initialForm).map((field) => [field, teacher[field] ?? ''])),
  };
}

export default function TeachersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const canCreate = user.role === 'admin';
  const canEdit = user.role === 'admin';
  const canDelete = user.role === 'admin';

  const { data, loading, error, refresh } = usePageData(
    () => api.get(`/teachers?page=${page}&limit=10&search=${encodeURIComponent(search)}`).then((response) => response.data),
    [page, search],
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateDialog() {
    setEditingTeacher(null);
    setForm(initialForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(teacher) {
    setEditingTeacher(teacher);
    setForm(teacherToForm(teacher));
    setFormError('');
    setDialogOpen(true);
  }

  function closeTeacherDialog(force = false) {
    if (saving && !force) return;
    setDialogOpen(false);
    setEditingTeacher(null);
    setForm(initialForm);
    setFormError('');
  }

  async function saveTeacher(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = Object.fromEntries(
      Object.entries(form).map(([field, value]) => [field, value === '' ? null : value]),
    );
    if (!editingTeacher) delete payload.teacher_code;
    
    if (payload.hourly_rate !== null && payload.hourly_rate !== undefined) {
        payload.hourly_rate = Number(payload.hourly_rate);
    }
    
    try {
      if (editingTeacher) await api.put(`/teachers/${editingTeacher.teacher_id}`, payload);
      else await api.post('/teachers', payload);
      closeTeacherDialog(true);
      if (!editingTeacher) setPage(1);
      refresh();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function askToDelete(teacher) {
    setDeleteTarget(teacher);
    setDeleteError('');
  }

  async function deleteTeacher() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/teachers/${deleteTarget.teacher_id}`);
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
        title="Giáo viên"
        description="Quản lý danh sách và hồ sơ giáo viên."
        action={canCreate && <Button appearance="primary" icon={<Add24Regular />} onClick={openCreateDialog}>Thêm giáo viên</Button>}
      />
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <Input aria-label="Tìm giáo viên" contentBefore={<Search24Regular />} placeholder="Tìm theo tên, mã hoặc email" value={searchInput} onChange={(_, dataValue) => setSearchInput(dataValue.value)} />
        <Button type="submit" appearance="secondary">Tìm kiếm</Button>
      </form>

      {loading && <LoadingState rows={7} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && <EmptyState title="Chưa tìm thấy giáo viên" description={canCreate ? 'Thử từ khóa khác hoặc thêm hồ sơ giáo viên mới.' : 'Thử từ khóa khác.'} />}
      {data?.items.length > 0 && (
        <div className="table-surface student-table">
          <Table aria-label="Danh sách giáo viên">
            <TableHeader><TableRow>
              <TableHeaderCell>Giáo viên</TableHeaderCell>
              <TableHeaderCell>Liên hệ</TableHeaderCell>
              <TableHeaderCell>Chuyên môn</TableHeaderCell>
              <TableHeaderCell>Lương / Giờ</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              {(canEdit || canDelete) && <TableHeaderCell>Thao tác</TableHeaderCell>}
            </TableRow></TableHeader>
            <TableBody>{data.items.map((teacher) => (
              <TableRow key={teacher.teacher_id}>
                <TableCell><div className="primary-cell"><span className="initial-tile">{teacher.full_name.slice(0, 1)}</span><div><strong>{teacher.full_name}</strong><span>{teacher.teacher_code}</span></div></div></TableCell>
                <TableCell><div className="stacked-cell"><span>{teacher.phone || 'Chưa có số điện thoại'}</span><small>{teacher.email || 'Chưa có email'}</small></div></TableCell>
                <TableCell>{teacher.specialization || 'Chưa cập nhật'}</TableCell>
                <TableCell>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(teacher.hourly_rate || 0)}</TableCell>
                <TableCell><StatusBadge status={teacher.status} /></TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="student-actions">
                      {canEdit && <Button appearance="subtle" size="small" icon={<Edit24Regular />} aria-label={`Sửa ${teacher.full_name}`} title="Chỉnh sửa" onClick={() => openEditDialog(teacher)} />}
                      {canDelete && <Button appearance="subtle" size="small" icon={<Delete24Regular />} aria-label={`Xóa ${teacher.full_name}`} title="Xóa giáo viên" onClick={() => askToDelete(teacher)} />}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}</TableBody>
          </Table>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => { if (!details.open) closeTeacherDialog(); }}>
        <DialogSurface className="student-dialog"><form onSubmit={saveTeacher}><DialogBody>
          <DialogTitle>{editingTeacher ? `Chỉnh sửa ${editingTeacher.full_name}` : 'Thêm giáo viên mới'}</DialogTitle>
          <DialogContent className="form-grid student-form">
            {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
            <Field label="Mã giáo viên"><Input disabled={!editingTeacher} value={editingTeacher ? form.teacher_code : 'Tự động tạo khi lưu'} onChange={(_, dataValue) => updateField('teacher_code', dataValue.value)} /></Field>
            <Field label="Họ và tên" required><Input value={form.full_name} onChange={(_, dataValue) => updateField('full_name', dataValue.value)} /></Field>
            <Field label="Số điện thoại"><Input value={form.phone} onChange={(_, dataValue) => updateField('phone', dataValue.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(_, dataValue) => updateField('email', dataValue.value)} /></Field>
            <Field label="Chuyên môn"><Input value={form.specialization} onChange={(_, dataValue) => updateField('specialization', dataValue.value)} placeholder="Toán học" /></Field>
            <Field label="Lương theo giờ (VND)"><Input type="number" value={form.hourly_rate} onChange={(_, dataValue) => updateField('hourly_rate', dataValue.value)} /></Field>
            <Field label="Trạng thái"><Select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="paused">Tạm nghỉ</option></Select></Field>
            <Field label="Địa chỉ"><Input value={form.address} onChange={(_, dataValue) => updateField('address', dataValue.value)} /></Field>
            <Field className="form-grid__wide" label="Ghi chú"><Textarea resize="vertical" value={form.note} onChange={(_, dataValue) => updateField('note', dataValue.value)} /></Field>
          </DialogContent>
          <DialogActions><Button type="button" appearance="secondary" disabled={saving} onClick={() => closeTeacherDialog()}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || !form.full_name.trim() || (editingTeacher && !form.teacher_code.trim())}>{saving ? 'Đang lưu...' : editingTeacher ? 'Lưu thay đổi' : 'Lưu giáo viên'}</Button></DialogActions>
        </DialogBody></form></DialogSurface>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, details) => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <DialogSurface><DialogBody>
          <DialogTitle>Xóa hồ sơ giáo viên?</DialogTitle>
          <DialogContent>
            {deleteError && <MessageBar intent="error"><MessageBarBody>{deleteError}</MessageBarBody></MessageBar>}
            <p className="delete-confirmation">Hồ sơ của <strong>{deleteTarget?.full_name}</strong> và các dữ liệu liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.</p>
          </DialogContent>
          <DialogActions><Button appearance="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button><Button className="danger-button" appearance="primary" disabled={deleting} onClick={deleteTeacher}>{deleting ? 'Đang xóa...' : 'Xóa giáo viên'}</Button></DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </div>
  );
}
