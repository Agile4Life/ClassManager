import { useEffect, useMemo, useState } from 'react';
import {
  Badge, Field, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
} from '../components/bootstrap-ui';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import { formatDate, formatTime } from '../utils/format';

const attendanceHistoryRoles = ['admin', 'teacher'];

function toLocalIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getHistoryRange() {
  const today = new Date();
  return {
    fromDate: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth() - 3, 1)),
    toDate: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth() + 2, 0)),
  };
}

function attendanceState(status) {
  if (status === 'not_taken' || !status) return 'not-taken';
  if (status === 'absent' || status === 'excused') return 'absent';
  return 'present';
}

const statusLabels = {
  present: 'Có mặt',
  absent: 'Vắng mặt',
  'not-taken': 'Chưa điểm danh',
};

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  if (!attendanceHistoryRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <AttendanceHistoryWorkspace user={user} />;
}

function AttendanceHistoryWorkspace({ user }) {
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const range = useMemo(() => getHistoryRange(), []);

  const { data: classes, loading: classesLoading, error: classesError, refresh: refreshClasses } = usePageData(
    () => api.get('/classes?limit=100').then((response) => response.data.items),
    [user.role],
  );

  useEffect(() => {
    setStudentId('');
    if (!classId) {
      setHistory([]);
      setHistoryError('');
      return undefined;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    api.post(`/classes/${classId}/generate-sessions`, { from_date: range.fromDate, to_date: range.toDate })
      .then(() => api.get(`/classes/${classId}/attendance-history?from_date=${range.fromDate}&to_date=${range.toDate}`))
      .then((response) => {
        if (active) setHistory(response.data);
      })
      .catch((requestError) => active && setHistoryError(requestError.message))
      .finally(() => active && setHistoryLoading(false));
    return () => { active = false; };
  }, [classId, range.fromDate, range.toDate]);

  const students = useMemo(() => {
    const byId = new Map();
    history.forEach((item) => {
      byId.set(String(item.student_id), {
        student_id: String(item.student_id),
        student_code: item.student_code,
        student_name: item.student_name,
      });
    });
    return [...byId.values()].sort((a, b) => a.student_name.localeCompare(b.student_name, 'vi'));
  }, [history]);

  const filteredHistory = studentId
    ? history.filter((item) => String(item.student_id) === studentId)
    : history;

  const summary = filteredHistory.reduce((result, item) => {
    result[attendanceState(item.attendance_status)] += 1;
    return result;
  }, { present: 0, absent: 0, 'not-taken': 0 });

  return (
    <div className="page-flow attendance-history-page">
      <PageHeader
        title="Lịch sử điểm danh"
        description="Theo dõi từng học sinh đã có mặt, vắng mặt hay chưa được điểm danh trong từng buổi học."
      />

      {classesLoading && <LoadingState rows={3} />}
      {classesError && <ErrorState message={classesError} onRetry={refreshClasses} />}
      {classes && (
        <section className="attendance-history-filters" aria-label="Bộ lọc lịch sử điểm danh">
          <Field label="Lớp học" required>
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">Chọn lớp học</option>
              {classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_code} - {item.class_name}</option>)}
            </Select>
          </Field>
          <Field label="Học sinh">
            <Select value={studentId} disabled={!students.length} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">Tất cả học sinh</option>
              {students.map((student) => (
                <option key={student.student_id} value={student.student_id}>
                  {student.student_code} - {student.student_name}
                </option>
              ))}
            </Select>
          </Field>
        </section>
      )}

      {historyLoading && <LoadingState rows={6} />}
      {historyError && <ErrorState message={historyError} />}
      {!classId && !classesLoading && <EmptyState title="Chọn lớp để xem lịch sử" description="Sau khi chọn lớp, hệ thống sẽ hiển thị trạng thái điểm danh của từng học sinh theo từng buổi." />}
      {classId && !historyLoading && !historyError && !history.length && (
        <EmptyState title="Chưa có buổi học" description="Lớp này chưa có buổi học trong phạm vi hiển thị." />
      )}

      {!!filteredHistory.length && (
        <>
          <section className="attendance-history-summary" aria-label="Tổng hợp lịch sử điểm danh">
            <div><span>Có mặt</span><strong>{summary.present}</strong></div>
            <div><span>Vắng mặt</span><strong>{summary.absent}</strong></div>
            <div><span>Chưa điểm danh</span><strong>{summary['not-taken']}</strong></div>
          </section>

          <div className="table-surface attendance-history-table">
            <Table aria-label="Lịch sử điểm danh học sinh">
              <TableHeader><TableRow>
                <TableHeaderCell>Buổi học</TableHeaderCell>
                <TableHeaderCell>Học sinh</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
                <TableHeaderCell>Ghi chú</TableHeaderCell>
              </TableRow></TableHeader>
              <TableBody>{filteredHistory.map((item) => {
                const state = attendanceState(item.attendance_status);
                return (
                  <TableRow key={`${item.session_id}-${item.student_id}`}>
                    <TableCell>
                      <div className="stacked-cell">
                        <span>{formatDate(item.session_date)}</span>
                        <small>{formatTime(item.start_time)}{item.end_time ? ` - ${formatTime(item.end_time)}` : ''}</small>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="stacked-cell">
                        <strong>{item.student_name}</strong>
                        <small>{item.student_code}</small>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={`attendance-status attendance-status--${state}`}>{statusLabels[state]}</Badge></TableCell>
                    <TableCell>{item.note || item.topic || 'Không có'}</TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
