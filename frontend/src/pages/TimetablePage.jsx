import { useMemo, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select,
} from '../components/bootstrap-ui';
import { Add24Regular, CalendarLtr24Regular } from '../components/bootstrap-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import { dayLabels, formatTime } from '../utils/format';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const initialForm = { class_id: '', room_id: '', day_of_week: 'monday', start_time: '18:00', end_time: '19:30' };

function pathForUser(user) {
  if (user.role === 'student') return `/timetable/student/${user.student_id}`;
  if (user.role === 'parent') return `/timetable/parent/${user.parent_id}`;
  return '/timetable';
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [dayFilter, setDayFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const canManage = ['admin', 'staff'].includes(user.role);

  const { data, loading, error, refresh } = usePageData(async () => {
    const requests = [api.get(pathForUser(user))];
    if (canManage) requests.push(api.get('/classes?limit=100'), api.get('/rooms?limit=100'));
    const [timetable, classes, rooms] = await Promise.all(requests);
    return { items: timetable.data, classes: classes?.data?.items || [], rooms: rooms?.data?.items || [] };
  }, [user.role]);

  const grouped = useMemo(() => Object.fromEntries(days.map((day) => [day, (data?.items || []).filter((item) => item.day_of_week === day)])), [data]);
  const visibleDays = dayFilter === 'all' ? days : [dayFilter];
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function createSchedule(event) {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      await api.post(`/classes/${form.class_id}/schedules`, { room_id: Number(form.room_id), day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time });
      setDialogOpen(false); setForm(initialForm); refresh();
    } catch (requestError) { setFormError(requestError.message); } finally { setSaving(false); }
  }

  return (
    <div className="page-flow">
      <PageHeader title="Thời khóa biểu" description="Một tuần học rõ ràng cho lớp, giáo viên và phòng học." action={canManage && <Button appearance="primary" icon={<Add24Regular />} onClick={() => setDialogOpen(true)}>Xếp lịch học</Button>} />
      <div className="toolbar"><Select aria-label="Lọc theo ngày" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}><option value="all">Cả tuần</option>{days.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}</Select></div>
      {loading && <LoadingState rows={6} />}{error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && <EmptyState title="Chưa có lịch học" description="Khi lớp được xếp lịch, tuần học sẽ hiện ở đây." />}
      {data?.items.length > 0 && <section className={`timetable-board ${visibleDays.length === 1 ? 'timetable-board--single' : ''}`} aria-label="Lịch học trong tuần">{visibleDays.map((day) => <div className="day-column" key={day}>
        <div className="day-column__heading"><span>{dayLabels[day]}</span><small>{grouped[day].length} buổi</small></div>
        <div className="day-column__body">{grouped[day].map((item) => <article className="lesson-card" key={`${item.schedule_id || item.class_id}-${item.start_time}-${item.student_id || ''}`}>
          <span className="lesson-card__time">{formatTime(item.start_time)} - {formatTime(item.end_time)}</span><strong>{item.class_name}</strong><p>{item.subject_name}</p><div><span>{item.room_name || 'Chưa xếp phòng'}</span><small>{item.teacher_name || item.student_name || ''}</small></div>
        </article>)}{!grouped[day].length && <div className="day-column__empty"><CalendarLtr24Regular /><span>Trống lịch</span></div>}</div>
      </div>)}</section>}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => setDialogOpen(details.open)}><DialogSurface><form onSubmit={createSchedule}><DialogBody><DialogTitle>Xếp lịch học</DialogTitle><DialogContent className="form-grid">
        {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
        <Field label="Lớp học" required><Select value={form.class_id} onChange={(event) => updateField('class_id', event.target.value)}><option value="">Chọn lớp</option>{data?.classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_code} - {item.class_name}</option>)}</Select></Field>
        <Field label="Phòng học" required><Select value={form.room_id} onChange={(event) => updateField('room_id', event.target.value)}><option value="">Chọn phòng</option>{data?.rooms.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_name}</option>)}</Select></Field>
        <Field label="Ngày trong tuần"><Select value={form.day_of_week} onChange={(event) => updateField('day_of_week', event.target.value)}>{days.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}</Select></Field><div />
        <Field label="Bắt đầu"><Input type="time" value={form.start_time} onChange={(_, value) => updateField('start_time', value.value)} /></Field><Field label="Kết thúc"><Input type="time" value={form.end_time} onChange={(_, value) => updateField('end_time', value.value)} /></Field>
      </DialogContent><DialogActions><Button appearance="secondary" onClick={() => setDialogOpen(false)}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || !form.class_id || !form.room_id}>{saving ? 'Đang xếp lịch...' : 'Lưu lịch học'}</Button></DialogActions></DialogBody></form></DialogSurface></Dialog>
    </div>
  );
}
