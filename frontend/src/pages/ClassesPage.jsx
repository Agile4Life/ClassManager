import { useMemo, useState } from 'react';
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

const initialForm = { class_code: '', class_name: '', subject_id: '', teacher_id: '', room_id: '', grade_level: '', status: 'active' };

export default function ClassesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const canManage = ['admin', 'staff'].includes(user.role);

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

  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  async function createClass(event) {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
      for (const key of ['subject_id', 'teacher_id', 'room_id']) if (payload[key] !== undefined) payload[key] = Number(payload[key]);
      payload.max_students = 40;
      await api.post('/classes', payload);
      setDialogOpen(false); setForm(initialForm); setPage(1); refreshClasses();
    } catch (requestError) { setFormError(requestError.message); } finally { setSaving(false); }
  }

  return (
    <div className="page-flow">
      <PageHeader title="Lớp học" description="Một góc nhìn rõ ràng cho lịch trình và thông tin từng lớp." action={canManage && <Button appearance="primary" icon={<Add24Regular />} onClick={() => setDialogOpen(true)}>Tạo lớp học</Button>} />
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}><Input aria-label="Tìm lớp học" contentBefore={<Search24Regular />} placeholder="Tìm theo tên hoặc mã lớp" value={searchInput} onChange={(_, value) => setSearchInput(value.value)} /><Button type="submit">Tìm kiếm</Button></form>
      {(classesLoading || referencesLoading) && <LoadingState rows={7} />}
      {classesError && <ErrorState message={classesError} onRetry={refreshClasses} />}
      {referencesError && <ErrorState message={referencesError} onRetry={refreshReferences} />}
      {classData && referenceData && !classData.items.length && <EmptyState title="Chưa có lớp học" description="Tạo lớp đầu tiên để bắt đầu xếp lịch." />}
      {classData?.items.length > 0 && referenceData && <div className="table-surface"><Table aria-label="Danh sách lớp học"><TableHeader><TableRow><TableHeaderCell>Lớp</TableHeaderCell><TableHeaderCell>Môn học</TableHeaderCell><TableHeaderCell>Giáo viên</TableHeaderCell><TableHeaderCell>Thời gian</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell></TableRow></TableHeader><TableBody>{classData.items.map((item) => <TableRow key={item.class_id}>
        <TableCell><div className="primary-cell"><span className="class-code">{item.class_code}</span><div><strong>{item.class_name}</strong><span>{maps.rooms[item.room_id] || 'Chưa xếp phòng'}</span></div></div></TableCell>
        <TableCell>{maps.subjects[item.subject_id] || `Môn #${item.subject_id}`}</TableCell><TableCell>{maps.teachers[item.teacher_id] || 'Chưa phân công'}</TableCell>
        <TableCell><div className="stacked-cell"><span>{formatDate(item.start_date)}</span><small>đến {formatDate(item.end_date)}</small></div></TableCell><TableCell><StatusBadge status={item.status} /></TableCell>
      </TableRow>)}</TableBody></Table><Pagination pagination={classData.pagination} onPageChange={setPage} /></div>}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => setDialogOpen(details.open)}><DialogSurface><form onSubmit={createClass}><DialogBody><DialogTitle>Tạo lớp học mới</DialogTitle><DialogContent className="form-grid">
        {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
        <Field label="Mã lớp" required><Input value={form.class_code} onChange={(_, value) => updateField('class_code', value.value)} placeholder="C004" /></Field><Field label="Tên lớp" required><Input value={form.class_name} onChange={(_, value) => updateField('class_name', value.value)} /></Field>
        <Field label="Môn học" required><Select value={form.subject_id} onChange={(event) => updateField('subject_id', event.target.value)}><option value="">Chọn môn học</option>{referenceData?.subjects.map((item) => <option key={item.subject_id} value={item.subject_id}>{item.subject_name}</option>)}</Select></Field>
        <Field label="Giáo viên"><Select value={form.teacher_id} onChange={(event) => updateField('teacher_id', event.target.value)}><option value="">Chưa phân công</option>{referenceData?.teachers.map((item) => <option key={item.teacher_id} value={item.teacher_id}>{item.full_name}</option>)}</Select></Field>
        <Field label="Phòng học"><Select value={form.room_id} onChange={(event) => updateField('room_id', event.target.value)}><option value="">Chưa xếp phòng</option>{referenceData?.rooms.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_name}</option>)}</Select></Field><Field label="Khối lớp"><Input value={form.grade_level} onChange={(_, value) => updateField('grade_level', value.value)} /></Field>
      </DialogContent><DialogActions><Button appearance="secondary" onClick={() => setDialogOpen(false)}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || !form.class_code || !form.class_name || !form.subject_id}>{saving ? 'Đang tạo...' : 'Tạo lớp'}</Button></DialogActions></DialogBody></form></DialogSurface></Dialog>
    </div>
  );
}
