import { useEffect, useMemo, useState } from 'react';
import {
  Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select, Table, TableBody, TableCell,
  TableHeader, TableHeaderCell, TableRow,
} from '../components/bootstrap-ui';
import { Add24Regular, Delete24Regular, Edit24Regular, Search24Regular } from '../components/bootstrap-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { usePageData } from '../hooks/usePageData';
import { formatDate } from '../utils/format';

const initialForm = {
  class_code: '',
  class_name: '',
  subject_id: '',
  teacher_ids: [],
  room_id: '',
  grade_level: '',
  status: 'active',
};

export default function ClassesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [classStudentsLoading, setClassStudentsLoading] = useState(false);
  const [classStudentsError, setClassStudentsError] = useState('');
  const canManage = ['admin', 'staff'].includes(user.role);
  const canDelete = user.role === 'admin';
  const canViewClassStudents = ['admin', 'staff', 'teacher'].includes(user.role);

  const { data: classData, loading: classesLoading, error: classesError, refresh: refreshClasses } = usePageData(
    () => api.get(`/classes?page=${page}&limit=10&search=${encodeURIComponent(search)}`).then((response) => response.data),
    [page, search],
  );

  const { data: referenceData, loading: referencesLoading, error: referencesError, refresh: refreshReferences } = usePageData(async () => {
    const requests = [api.get('/subjects?limit=100'), api.get('/teachers?limit=100')];
    if (['admin', 'staff', 'teacher'].includes(user.role)) requests.push(api.get('/rooms?limit=100'));
    const [subjects, teachers, rooms] = await Promise.all(requests);
    return { subjects: subjects.data.items, teachers: teachers.data.items, rooms: rooms?.data?.items || [] };
  }, [user.role]);

  const maps = useMemo(() => ({
    subjects: Object.fromEntries((referenceData?.subjects || []).map((item) => [item.subject_id, item.subject_name])),
    teachers: Object.fromEntries((referenceData?.teachers || []).map((item) => [item.teacher_id, item.full_name])),
    rooms: Object.fromEntries((referenceData?.rooms || []).map((item) => [item.room_id, item.room_name])),
  }), [referenceData]);

  const visibleClasses = useMemo(
    () => (classData?.items || []).filter((item) => item.status !== 'cancelled'),
    [classData],
  );

  useEffect(() => {
    if (!selectedClass || !canViewClassStudents) {
      setClassStudents([]);
      setClassStudentsError('');
      return undefined;
    }

    let active = true;
    setClassStudentsLoading(true);
    setClassStudentsError('');
    api.get(`/classes/${selectedClass.class_id}/students`)
      .then((response) => {
        if (active) setClassStudents(response.data);
      })
      .catch((requestError) => {
        if (active) setClassStudentsError(requestError.message);
      })
      .finally(() => {
        if (active) setClassStudentsLoading(false);
      });

    return () => { active = false; };
  }, [selectedClass, canViewClassStudents]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleTeacher(teacherId, checked) {
    setForm((current) => {
      const selected = new Set(current.teacher_ids.map(String));
      if (checked) selected.add(String(teacherId));
      else selected.delete(String(teacherId));
      return { ...current, teacher_ids: [...selected] };
    });
  }

  function selectClass(item) {
    if (!canViewClassStudents) return;
    setSelectedClass(item);
  }

  function selectClassWithKeyboard(event, item) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectClass(item);
  }

  function openCreateDialog() {
    setEditingClass(null);
    setForm(initialForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(item) {
    setEditingClass(item);
    setForm({
      class_code: item.class_code || '',
      class_name: item.class_name || '',
      subject_id: item.subject_id ? String(item.subject_id) : '',
      teacher_ids: (item.teacher_ids || []).map(String),
      room_id: item.room_id ? String(item.room_id) : '',
      grade_level: item.grade_level || '',
      status: item.status || 'active',
    });
    setFormError('');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingClass(null);
    setForm(initialForm);
    setFormError('');
  }

  async function saveClass(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
      for (const key of ['subject_id', 'room_id']) {
        if (payload[key] !== undefined) payload[key] = Number(payload[key]);
      }
      payload.teacher_ids = form.teacher_ids.map(Number);
      payload.teacher_id = payload.teacher_ids[0] || null;
      if (!editingClass) payload.max_students = 40;
      if (editingClass) await api.put(`/classes/${editingClass.class_id}`, payload);
      else await api.post('/classes', payload);
      closeDialog();
      setPage(1);
      refreshClasses();
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function askToDelete(item) {
    setDeleteTarget(item);
    setDeleteError('');
  }

  async function deleteClass() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.put(`/classes/${deleteTarget.class_id}`, { status: 'cancelled' });
      if (String(selectedClass?.class_id) === String(deleteTarget.class_id)) setSelectedClass(null);
      setDeleteTarget(null);
      refreshClasses();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-flow">
      <PageHeader
        title="Lớp học"
        description="Một góc nhìn rõ ràng cho lịch trình và thông tin từng lớp."
        action={canManage && <Button appearance="primary" icon={<Add24Regular />} onClick={openCreateDialog}>Tạo lớp học</Button>}
      />

      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
        <Input
          aria-label="Tìm lớp học"
          contentBefore={<Search24Regular />}
          placeholder="Tìm theo tên hoặc mã lớp"
          value={searchInput}
          onChange={(_, value) => setSearchInput(value.value)}
        />
        <Button type="submit">Tìm kiếm</Button>
      </form>

      {(classesLoading || referencesLoading) && <LoadingState rows={7} />}
      {classesError && <ErrorState message={classesError} onRetry={refreshClasses} />}
      {referencesError && <ErrorState message={referencesError} onRetry={refreshReferences} />}
      {classData && referenceData && !visibleClasses.length && (
        <EmptyState title="Chưa có lớp học" description="Tạo lớp đầu tiên để bắt đầu xếp lịch." />
      )}

      {visibleClasses.length > 0 && referenceData && (
        <div className="table-surface">
          <Table aria-label="Danh sách lớp học">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Lớp</TableHeaderCell>
                <TableHeaderCell>Môn học</TableHeaderCell>
                <TableHeaderCell>Giáo viên</TableHeaderCell>
                <TableHeaderCell>Thời gian</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                {canManage && <TableHeaderCell>Thao tác</TableHeaderCell>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleClasses.map((item) => {
                const isSelected = String(selectedClass?.class_id) === String(item.class_id);
                return (
                  <TableRow
                    key={item.class_id}
                    className={`${canViewClassStudents ? 'class-select-row' : ''} ${isSelected ? 'class-select-row--active' : ''}`.trim()}
                    tabIndex={canViewClassStudents ? 0 : undefined}
                    aria-selected={canViewClassStudents ? isSelected : undefined}
                    onClick={() => selectClass(item)}
                    onKeyDown={(event) => selectClassWithKeyboard(event, item)}
                  >
                    <TableCell>
                      <div className="primary-cell">
                        <span className="class-code">{item.class_code}</span>
                        <div><strong>{item.class_name}</strong><span>{maps.rooms[item.room_id] || 'Chưa xếp phòng'}</span></div>
                      </div>
                    </TableCell>
                    <TableCell>{maps.subjects[item.subject_id] || `Môn #${item.subject_id}`}</TableCell>
                    <TableCell>{item.teachers?.length ? item.teachers.map((teacher) => teacher.full_name).join(', ') : 'Chưa phân công'}</TableCell>
                    <TableCell><div className="stacked-cell"><span>{formatDate(item.start_date)}</span><small>đến {formatDate(item.end_date)}</small></div></TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="student-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                          <Button appearance="subtle" size="small" icon={<Edit24Regular />} aria-label={`Sửa ${item.class_name}`} title="Chỉnh sửa lớp" onClick={() => openEditDialog(item)} />
                          {canDelete && item.status !== 'cancelled' && (
                            <Button appearance="subtle" size="small" icon={<Delete24Regular />} aria-label={`Ngừng ${item.class_name}`} title="Ngừng lớp học" onClick={() => askToDelete(item)} />
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination pagination={classData.pagination} onPageChange={setPage} />
        </div>
      )}

      {canViewClassStudents && selectedClass && (
        <section className="surface class-students-panel" aria-labelledby="class-students-title">
          <div className="surface-heading">
            <div><span>{selectedClass.class_code}</span><h2 id="class-students-title">Học sinh của {selectedClass.class_name}</h2></div>
          </div>
          {classStudentsLoading && <LoadingState rows={4} />}
          {classStudentsError && <ErrorState message={classStudentsError} />}
          {!classStudentsLoading && !classStudentsError && !classStudents.length && (
            <EmptyState title="Lớp chưa có học sinh" description="Khi học sinh được ghi danh, danh sách sẽ hiện ở đây." />
          )}
          {!classStudentsLoading && !classStudentsError && classStudents.length > 0 && (
            <div className="table-surface class-students-table">
              <Table aria-label={`Danh sách học sinh của ${selectedClass.class_name}`}>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Học sinh</TableHeaderCell>
                    <TableHeaderCell>Liên hệ</TableHeaderCell>
                    <TableHeaderCell>Ngày vào lớp</TableHeaderCell>
                    <TableHeaderCell>Trạng thái</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.map((student) => (
                    <TableRow key={student.enrollment_id || student.student_id}>
                      <TableCell><div className="primary-cell"><span className="initial-tile">{student.full_name.slice(0, 1)}</span><div><strong>{student.full_name}</strong><span>{student.student_code}</span></div></div></TableCell>
                      <TableCell>{student.phone || 'Chưa có số điện thoại'}</TableCell>
                      <TableCell>{formatDate(student.enrolled_date)}</TableCell>
                      <TableCell><StatusBadge status={student.enrollment_status || student.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => { if (!details.open) closeDialog(); }}>
        <DialogSurface>
          <form onSubmit={saveClass}>
            <DialogBody>
              <DialogTitle>{editingClass ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới'}</DialogTitle>
              <DialogContent className="form-grid">
                {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
                <Field label="Mã lớp"><Input disabled value={editingClass ? form.class_code : 'Tự động tạo khi lưu'} /></Field>
                <Field label="Tên lớp" required><Input value={form.class_name} onChange={(_, value) => updateField('class_name', value.value)} /></Field>
                <Field label="Môn học" required>
                  <Select value={form.subject_id} onChange={(event) => updateField('subject_id', event.target.value)}>
                    <option value="">Chọn môn học</option>
                    {referenceData?.subjects.map((item) => <option key={item.subject_id} value={item.subject_id}>{item.subject_name}</option>)}
                  </Select>
                </Field>
                <div className="form-field">
                  <span className="form-label">Giáo viên phụ trách</span>
                  <div className="teacher-checkbox-list">
                    {referenceData?.teachers.map((item) => (
                      <Checkbox
                        key={item.teacher_id}
                        label={item.full_name}
                        checked={form.teacher_ids.map(String).includes(String(item.teacher_id))}
                        onChange={(_, value) => toggleTeacher(item.teacher_id, value.checked)}
                      />
                    ))}
                  </div>
                </div>
                <Field label="Phòng học">
                  <Select value={form.room_id} onChange={(event) => updateField('room_id', event.target.value)}>
                    <option value="">Chưa xếp phòng</option>
                    {referenceData?.rooms.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_name}</option>)}
                  </Select>
                </Field>
                <Field label="Khối lớp"><Input value={form.grade_level} onChange={(_, value) => updateField('grade_level', value.value)} /></Field>
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" onClick={closeDialog}>Hủy</Button>
                <Button appearance="primary" type="submit" disabled={saving || !form.class_name || !form.subject_id}>
                  {saving ? 'Đang lưu...' : editingClass ? 'Lưu thay đổi' : 'Tạo lớp'}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, details) => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Ngừng lớp học?</DialogTitle>
            <DialogContent>
              {deleteError && <MessageBar intent="error"><MessageBarBody>{deleteError}</MessageBarBody></MessageBar>}
              <p className="delete-confirmation">Lớp <strong>{deleteTarget?.class_code} - {deleteTarget?.class_name}</strong> sẽ được chuyển sang trạng thái <strong>Đã hủy</strong>. Lịch học, buổi học và dữ liệu liên quan vẫn được giữ lại.</p>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button>
              <Button className="danger-button" appearance="primary" disabled={deleting} onClick={deleteClass}>{deleting ? 'Đang lưu...' : 'Ngừng lớp học'}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
