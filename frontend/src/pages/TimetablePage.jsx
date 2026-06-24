import { useMemo, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select,
} from '../components/bootstrap-ui';
import {
  Add24Regular, CalendarLtr24Regular, ChevronLeft24Regular, ChevronRight24Regular, Edit24Regular,
} from '../components/bootstrap-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import { dayLabels, formatTime } from '../utils/format';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayIdByJsDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const monthFormatter = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' });
const initialForm = { class_id: '', room_id: '', day_of_week: 'monday', start_time: '18:00', end_time: '19:30' };

function buildMonthGrid(monthCursor) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDate = new Date(year, month, 1);
  const mondayOffset = (firstDate.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => new Date(year, month, 1 - mondayOffset + index));
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDate(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function pathForUser(user) {
  if (user.role === 'student') return `/timetable/student/${user.student_id}`;
  if (user.role === 'parent') return `/timetable/parent/${user.parent_id}`;
  return '/timetable';
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState('week');
  const [dayFilter, setDayFilter] = useState('all');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const canCreate = ['admin', 'staff'].includes(user.role);
  const canEdit = ['admin', 'teacher'].includes(user.role);

  const { data, loading, error, refresh } = usePageData(async () => {
    const [timetable, classes, rooms] = await Promise.all([
      api.get(pathForUser(user)),
      canCreate ? api.get('/classes?limit=100') : Promise.resolve(null),
      (canCreate || canEdit) ? api.get('/rooms?limit=100') : Promise.resolve(null),
    ]);
    return { items: timetable.data, classes: classes?.data?.items || [], rooms: rooms?.data?.items || [] };
  }, [user.role, user.teacher_id, user.student_id, user.parent_id]);

  const grouped = useMemo(() => Object.fromEntries(days.map((day) => [day, (data?.items || []).filter((item) => item.day_of_week === day)])), [data]);
  const monthDates = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const monthTitle = useMemo(() => monthFormatter.format(monthCursor), [monthCursor]);
  const visibleDays = dayFilter === 'all' ? days : [dayFilter];
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  function moveMonth(offset) {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function showCurrentMonth() {
    const now = new Date();
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  function openCreateDialog() {
    setEditingSchedule(null);
    setForm(initialForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEditDialog(schedule) {
    setEditingSchedule(schedule);
    setForm({
      class_id: String(schedule.class_id),
      room_id: schedule.room_id ? String(schedule.room_id) : '',
      day_of_week: schedule.day_of_week,
      start_time: String(schedule.start_time).slice(0, 5),
      end_time: String(schedule.end_time).slice(0, 5),
    });
    setFormError('');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSchedule(null);
    setForm(initialForm);
    setFormError('');
  }

  function canEditSchedule(schedule) {
    if (user.role === 'admin') return true;
    return user.role === 'teacher' && String(schedule.teacher_id) === String(user.teacher_id);
  }

  async function saveSchedule(event) {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      const payload = { room_id: Number(form.room_id), day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time };
      if (editingSchedule) await api.put(`/schedules/${editingSchedule.schedule_id}`, payload);
      else await api.post(`/classes/${form.class_id}/schedules`, payload);
      closeDialog(); refresh();
    } catch (requestError) { setFormError(requestError.message); } finally { setSaving(false); }
  }

  return (
    <div className="page-flow">
      <PageHeader title="Thời khóa biểu" description="Tạo một tuần mẫu và xem lịch tự động lặp lại trong các tháng tiếp theo." action={canCreate && <Button appearance="primary" icon={<Add24Regular />} onClick={openCreateDialog}>Xếp lịch học</Button>} />
      <div className="timetable-toolbar">
        <div className="timetable-toolbar__filters">
          <Select aria-label="Chế độ xem thời khóa biểu" value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
            <option value="week">Tuần mẫu</option>
            <option value="month">Theo tháng</option>
          </Select>
          {viewMode === 'week' && <Select aria-label="Lọc theo ngày" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}><option value="all">Cả tuần</option>{days.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}</Select>}
        </div>
        {viewMode === 'month' && (
          <div className="timetable-month-nav" aria-label="Điều hướng tháng">
            <Button appearance="subtle" icon={<ChevronLeft24Regular />} aria-label="Tháng trước" onClick={() => moveMonth(-1)} />
            <strong>{monthTitle}</strong>
            <Button appearance="subtle" onClick={showCurrentMonth}>Tháng này</Button>
            <Button appearance="subtle" icon={<ChevronRight24Regular />} aria-label="Tháng sau" onClick={() => moveMonth(1)} />
          </div>
        )}
      </div>
      {loading && <LoadingState rows={6} />}{error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && <EmptyState title="Chưa có lịch học" description="Khi lớp được xếp lịch, tuần học sẽ hiện ở đây." />}
      {data?.items.length > 0 && viewMode === 'week' && <section className={`timetable-board ${visibleDays.length === 1 ? 'timetable-board--single' : ''}`} aria-label="Lịch học trong tuần">{visibleDays.map((day) => <div className="day-column" key={day}>
        <div className="day-column__heading"><span>{dayLabels[day]}</span><small>{grouped[day].length} buổi</small></div>
        <div className="day-column__body">{grouped[day].map((item) => <article className="lesson-card" key={`${item.schedule_id || item.class_id}-${item.start_time}-${item.student_id || ''}`}>
          <div className="lesson-card__top">
            <span className="lesson-card__time">{formatTime(item.start_time)} - {formatTime(item.end_time)}</span>
            {canEditSchedule(item) && (
              <Button appearance="subtle" className="lesson-card__edit" icon={<Edit24Regular />} aria-label={`Chỉnh sửa lịch ${item.class_name}`} title="Chỉnh sửa lịch" onClick={() => openEditDialog(item)} />
            )}
          </div>
          <strong>{item.class_name}</strong><p>{item.subject_name}</p><div className="lesson-card__meta"><span>{item.room_name || 'Chưa xếp phòng'}</span><small>{item.teacher_name || item.student_name || ''}</small></div>
        </article>)}{!grouped[day].length && <div className="day-column__empty"><CalendarLtr24Regular /><span>Trống lịch</span></div>}</div>
      </div>)}</section>}
      {data?.items.length > 0 && viewMode === 'month' && (
        <MonthCalendar
          dates={monthDates}
          monthCursor={monthCursor}
          grouped={grouped}
          title={monthTitle}
          canEditSchedule={canEditSchedule}
          onEdit={openEditDialog}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(_, details) => { if (!details.open) closeDialog(); }}><DialogSurface><form onSubmit={saveSchedule}><DialogBody><DialogTitle>{editingSchedule ? 'Chỉnh sửa lịch học' : 'Xếp lịch học'}</DialogTitle><DialogContent className="form-grid">
        {formError && <MessageBar intent="error" className="form-grid__wide"><MessageBarBody>{formError}</MessageBarBody></MessageBar>}
        {editingSchedule ? (
          <div className="schedule-edit-context form-grid__wide"><span>Lớp học</span><strong>{editingSchedule.class_code} - {editingSchedule.class_name}</strong><small>{editingSchedule.subject_name}</small></div>
        ) : (
          <Field label="Lớp học" required><Select value={form.class_id} onChange={(event) => updateField('class_id', event.target.value)}><option value="">Chọn lớp</option>{data?.classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_code} - {item.class_name}</option>)}</Select></Field>
        )}
        <Field label="Phòng học" required><Select value={form.room_id} onChange={(event) => updateField('room_id', event.target.value)}><option value="">Chọn phòng</option>{data?.rooms.map((item) => <option key={item.room_id} value={item.room_id}>{item.room_name}</option>)}</Select></Field>
        <Field label="Ngày trong tuần"><Select value={form.day_of_week} onChange={(event) => updateField('day_of_week', event.target.value)}>{days.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}</Select></Field><div />
        <Field label="Bắt đầu"><Input type="time" value={form.start_time} onChange={(_, value) => updateField('start_time', value.value)} /></Field><Field label="Kết thúc"><Input type="time" value={form.end_time} onChange={(_, value) => updateField('end_time', value.value)} /></Field>
      </DialogContent><DialogActions><Button appearance="secondary" onClick={closeDialog}>Hủy</Button><Button appearance="primary" type="submit" disabled={saving || (!editingSchedule && !form.class_id) || !form.room_id}>{saving ? 'Đang lưu...' : editingSchedule ? 'Lưu thay đổi' : 'Lưu lịch học'}</Button></DialogActions></DialogBody></form></DialogSurface></Dialog>
    </div>
  );
}

function MonthCalendar({ dates, monthCursor, grouped, title, canEditSchedule, onEdit }) {
  const today = new Date();
  return (
    <section className="month-calendar" aria-label={`Thời khóa biểu ${title}`}>
      <div className="month-calendar__grid" role="grid">
        {days.map((day) => <div className="month-calendar__weekday" role="columnheader" key={day}>{dayLabels[day]}</div>)}
        {dates.map((date) => {
          const schedules = grouped[dayIdByJsDay[date.getDay()]] || [];
          const outsideMonth = date.getMonth() !== monthCursor.getMonth();
          const todayCell = isSameDate(date, today);
          return (
            <div
              className={`month-calendar__day ${outsideMonth ? 'month-calendar__day--outside' : ''} ${todayCell ? 'month-calendar__day--today' : ''}`}
              role="gridcell"
              key={dateKey(date)}
            >
              <div className="month-calendar__date">
                <time dateTime={dateKey(date)}>{date.getDate()}</time>
                {!!schedules.length && <small>{schedules.length} buổi</small>}
              </div>
              <div className="month-calendar__lessons">
                {schedules.map((schedule) => {
                  const editable = canEditSchedule(schedule);
                  const content = (
                    <>
                      <span><strong>{formatTime(schedule.start_time)}</strong>{editable && <Edit24Regular aria-hidden="true" />}</span>
                      <b>{schedule.class_name}</b>
                      <small>{schedule.room_name || 'Chưa xếp phòng'}</small>
                    </>
                  );
                  return editable ? (
                    <button
                      type="button"
                      className="month-lesson month-lesson--editable"
                      aria-label={`Chỉnh sửa lịch ${schedule.class_name} ngày ${date.getDate()}`}
                      title="Chỉnh sửa lịch lặp"
                      key={`${dateKey(date)}-${schedule.schedule_id}`}
                      onClick={() => onEdit(schedule)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="month-lesson" key={`${dateKey(date)}-${schedule.schedule_id || schedule.class_id}`}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
