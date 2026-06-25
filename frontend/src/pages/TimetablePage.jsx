import { useMemo, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Select,
} from '../components/bootstrap-ui';
import {
  Add24Regular, CalendarLtr24Regular, ChevronLeft24Regular, ChevronRight24Regular, Delete24Regular, Edit24Regular,
} from '../components/bootstrap-icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import { dayLabels, formatTime } from '../utils/format';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const initialForm = { class_id: '', room_id: '', day_of_week: 'monday', start_time: '18:00', end_time: '19:30' };

function startOfIsoWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function getIsoWeek(date) {
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7));
  const isoYear = thursday.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return { year: isoYear, week: 1 + Math.round((thursday - firstThursday) / 604_800_000) };
}

function getWeeksInIsoYear(year) {
  return getIsoWeek(new Date(year, 11, 28)).week;
}

function getWeekDates(year, week) {
  const firstMonday = startOfIsoWeek(new Date(year, 0, 4));
  return days.map((_, index) => {
    const date = new Date(firstMonday);
    date.setDate(firstMonday.getDate() + ((week - 1) * 7) + index);
    return date;
  });
}

function formatShortDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
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
  const initialIsoWeek = useMemo(() => getIsoWeek(new Date()), []);
  const [viewMode, setViewMode] = useState('week');
  const [dayFilter, setDayFilter] = useState('all');
  const [calendarYear, setCalendarYear] = useState(initialIsoWeek.year);
  const [calendarWeek, setCalendarWeek] = useState(initialIsoWeek.week);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const canCreate = ['admin', 'staff'].includes(user.role);
  const canEdit = ['admin', 'staff', 'teacher'].includes(user.role);

  const { data, loading, error, refresh } = usePageData(async () => {
    const [timetable, classes, rooms] = await Promise.all([
      api.get(pathForUser(user)),
      canCreate ? api.get('/classes?limit=100') : Promise.resolve(null),
      (canCreate || canEdit) ? api.get('/rooms?limit=100') : Promise.resolve(null),
    ]);
    return { items: timetable.data, classes: classes?.data?.items || [], rooms: rooms?.data?.items || [] };
  }, [user.role, user.teacher_id, user.student_id, user.parent_id]);

  const grouped = useMemo(() => Object.fromEntries(days.map((day) => [day, (data?.items || []).filter((item) => item.day_of_week === day)])), [data]);
  const weekDates = useMemo(() => getWeekDates(calendarYear, calendarWeek), [calendarWeek, calendarYear]);
  const yearOptions = useMemo(() => Array.from({ length: 7 }, (_, index) => initialIsoWeek.year - 1 + index), [initialIsoWeek.year]);
  const weekOptions = useMemo(() => Array.from({ length: getWeeksInIsoYear(calendarYear) }, (_, index) => {
    const week = index + 1;
    const range = getWeekDates(calendarYear, week);
    return { week, label: `Tuần ${week} · ${formatShortDate(range[0])} - ${formatShortDate(range[6])}` };
  }), [calendarYear]);
  const visibleDays = dayFilter === 'all' ? days : [dayFilter];
  function updateField(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  function changeCalendarYear(value) {
    const year = Number(value);
    setCalendarYear(year);
    setCalendarWeek((current) => Math.min(current, getWeeksInIsoYear(year)));
  }

  function moveWeek(offset) {
    const monday = getWeekDates(calendarYear, calendarWeek)[0];
    monday.setDate(monday.getDate() + (offset * 7));
    const next = getIsoWeek(monday);
    setCalendarYear(next.year);
    setCalendarWeek(next.week);
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
    if (['admin', 'staff'].includes(user.role)) return true;
    return user.role === 'teacher' && String(schedule.teacher_id) === String(user.teacher_id);
  }

  function askToDeleteSchedule(schedule) {
    setDeleteTarget(schedule);
    setDeleteError('');
  }

  async function deleteSchedule() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/schedules/${deleteTarget.schedule_id}`);
      setDeleteTarget(null);
      refresh();
    } catch (requestError) {
      setDeleteError(requestError.message);
    } finally {
      setDeleting(false);
    }
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
            <option value="calendar">Lịch lặp theo tuần</option>
          </Select>
          {viewMode === 'week' && <Select aria-label="Lọc theo ngày" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}><option value="all">Cả tuần</option>{days.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}</Select>}
        </div>
        {viewMode === 'calendar' && (
          <div className="recurring-week-controls" aria-label="Chọn tuần hiển thị">
            <Button appearance="subtle" icon={<ChevronLeft24Regular />} aria-label="Tuần trước" onClick={() => moveWeek(-1)} />
            <Select aria-label="Chọn năm" value={calendarYear} onChange={(event) => changeCalendarYear(event.target.value)}>
              {yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}
            </Select>
            <Select aria-label="Chọn tuần" value={calendarWeek} onChange={(event) => setCalendarWeek(Number(event.target.value))}>
              {weekOptions.map((item) => <option value={item.week} key={item.week}>{item.label}</option>)}
            </Select>
            <Button appearance="subtle" icon={<ChevronRight24Regular />} aria-label="Tuần sau" onClick={() => moveWeek(1)} />
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
              <div className="lesson-card__actions">
                <Button appearance="subtle" className="lesson-card__action" icon={<Edit24Regular />} aria-label={`Chỉnh sửa lịch ${item.class_name}`} title="Chỉnh sửa lịch" onClick={() => openEditDialog(item)} />
                <Button appearance="subtle" className="lesson-card__action lesson-card__action--danger" icon={<Delete24Regular />} aria-label={`Xóa lịch ${item.class_name}`} title="Xóa lịch" onClick={() => askToDeleteSchedule(item)} />
              </div>
            )}
          </div>
          <strong>{item.class_name}</strong><p>{item.subject_name}</p><div className="lesson-card__meta"><span>{item.room_name || 'Chưa xếp phòng'}</span><small>{item.teacher_name || item.student_name || ''}</small></div>
        </article>)}{!grouped[day].length && <div className="day-column__empty"><CalendarLtr24Regular /><span>Trống lịch</span></div>}</div>
      </div>)}</section>}
      {data?.items.length > 0 && viewMode === 'calendar' && (
        <RecurringWeekTable
          dates={weekDates}
          grouped={grouped}
          canEditSchedule={canEditSchedule}
          onEdit={openEditDialog}
          onDelete={askToDeleteSchedule}
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

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, details) => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <DialogSurface><DialogBody>
          <DialogTitle>Xóa lịch học?</DialogTitle>
          <DialogContent>
            {deleteError && <MessageBar intent="error"><MessageBarBody>{deleteError}</MessageBarBody></MessageBar>}
            <p className="delete-confirmation">Lịch <strong>{deleteTarget?.class_name}</strong> vào <strong>{deleteTarget ? dayLabels[deleteTarget.day_of_week] : ''}</strong>, từ <strong>{deleteTarget ? formatTime(deleteTarget.start_time) : ''}</strong> đến <strong>{deleteTarget ? formatTime(deleteTarget.end_time) : ''}</strong> sẽ bị xóa khỏi tuần mẫu. Thao tác này không thể hoàn tác.</p>
          </DialogContent>
          <DialogActions><Button appearance="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button><Button className="danger-button" appearance="primary" disabled={deleting} onClick={deleteSchedule}>{deleting ? 'Đang xóa...' : 'Xóa lịch học'}</Button></DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </div>
  );
}

function RecurringWeekTable({ dates, grouped, canEditSchedule, onEdit, onDelete }) {
  const today = new Date();
  const weekNumber = getIsoWeek(dates[0]).week;
  return (
    <section className="recurring-schedule" aria-labelledby="recurring-schedule-title">
      <div className="recurring-schedule__heading">
        <div><span>Lịch lặp</span><h2 id="recurring-schedule-title">Tuần {weekNumber}</h2><p>{formatShortDate(dates[0])} đến {formatShortDate(dates[6])}</p></div>
        <small>Lặp từ tuần mẫu</small>
      </div>
      <div className="recurring-table-wrap">
        <table className="recurring-table">
          <thead>
            <tr>{days.map((day, index) => <th className={isSameDate(dates[index], today) ? 'recurring-table__today' : ''} scope="col" key={day}>{dayLabels[day]}</th>)}</tr>
            <tr>{dates.map((date) => <th className={isSameDate(date, today) ? 'recurring-table__today' : ''} scope="col" key={dateKey(date)}><time dateTime={dateKey(date)}>{formatShortDate(date)}</time></th>)}</tr>
          </thead>
          <tbody>
            <tr>{days.map((day, index) => {
              const date = dates[index];
              const schedules = grouped[day] || [];
              return (
                <td className={isSameDate(date, today) ? 'recurring-table__today-cell' : ''} key={dateKey(date)}>
                  <div className="recurring-table__lessons">
                    {schedules.map((schedule) => {
                      const editable = canEditSchedule(schedule);
                      const content = (
                        <>
                          <span>
                            <strong>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</strong>
                            {editable && (
                              <span className="recurring-lesson__actions">
                                <button type="button" aria-label={`Chỉnh sửa lịch ${schedule.class_name}`} title="Chỉnh sửa lịch" onClick={() => onEdit(schedule)}><Edit24Regular aria-hidden="true" /></button>
                                <button type="button" aria-label={`Xóa lịch ${schedule.class_name}`} title="Xóa lịch" onClick={() => onDelete(schedule)}><Delete24Regular aria-hidden="true" /></button>
                              </span>
                            )}
                          </span>
                          <b>{schedule.class_name}</b>
                          <small>{schedule.subject_name}</small>
                          <em>{schedule.room_name || 'Chưa xếp phòng'}</em>
                        </>
                      );
                      return <div className={editable ? 'recurring-lesson recurring-lesson--editable' : 'recurring-lesson'} key={`${dateKey(date)}-${schedule.schedule_id || schedule.class_id}`}>{content}</div>;
                    })}
                    {!schedules.length && <span className="recurring-table__empty">Không có lịch</span>}
                  </div>
                </td>
              );
            })}</tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
