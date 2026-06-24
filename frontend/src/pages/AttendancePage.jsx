import { useEffect, useMemo, useState } from 'react';
import { Button, Field, MessageBar, MessageBarBody, Radio, Select } from '@fluentui/react-components';
import { Save24Regular } from '@fluentui/react-icons';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import { formatDate, formatTime } from '../utils/format';

const attendanceRoles = ['admin', 'teacher'];

function pickDefaultSession(sessions) {
  const today = new Date().toISOString().slice(0, 10);
  return sessions.find((session) => String(session.session_date).slice(0, 10) === today)
    || sessions.find((session) => String(session.session_date).slice(0, 10) <= today)
    || sessions[sessions.length - 1];
}

function normalizeAttendanceStatus(status) {
  return ['absent', 'excused'].includes(status) ? 'absent' : 'present';
}

export default function AttendancePage() {
  const { user } = useAuth();
  if (!attendanceRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <AttendanceWorkspace user={user} />;
}

function AttendanceWorkspace({ user }) {
  const [classId, setClassId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const { data: classes, loading: classesLoading, error: classesError, refresh: refreshClasses } = usePageData(
    () => api.get('/classes?limit=100').then((response) => response.data.items),
    [user.role],
  );

  useEffect(() => {
    if (!classId) {
      setSessions([]);
      setSessionId('');
      return undefined;
    }
    let active = true;
    setSessionsLoading(true);
    setLoadError('');
    setSessionId('');
    setStudents([]);
    setAttendance({});
    api.get(`/classes/${classId}/sessions`)
      .then((response) => {
        if (!active) return;
        const sorted = [...response.data].sort((a, b) => {
          const aKey = `${String(a.session_date).slice(0, 10)} ${a.start_time || ''}`;
          const bKey = `${String(b.session_date).slice(0, 10)} ${b.start_time || ''}`;
          return bKey.localeCompare(aKey);
        });
        setSessions(sorted);
        const defaultSession = pickDefaultSession(sorted);
        setSessionId(defaultSession ? String(defaultSession.session_id) : '');
      })
      .catch((requestError) => active && setLoadError(requestError.message))
      .finally(() => active && setSessionsLoading(false));
    return () => { active = false; };
  }, [classId]);

  useEffect(() => {
    if (!classId || !sessionId) {
      setStudents([]);
      setAttendance({});
      return undefined;
    }
    let active = true;
    setAttendanceLoading(true);
    setLoadError('');
    setSaveMessage('');
    Promise.all([
      api.get(`/classes/${classId}/students`),
      api.get(`/sessions/${sessionId}/attendance`),
    ])
      .then(([studentsResponse, attendanceResponse]) => {
        if (!active) return;
        const activeStudents = studentsResponse.data.filter((student) => student.enrollment_status === 'studying');
        const savedByStudent = new Map(
          attendanceResponse.data.map((entry) => [String(entry.student_id), normalizeAttendanceStatus(entry.status)]),
        );
        setStudents(activeStudents);
        setAttendance(Object.fromEntries(activeStudents.map((student) => [
          String(student.student_id), savedByStudent.get(String(student.student_id)) || 'present',
        ])));
      })
      .catch((requestError) => active && setLoadError(requestError.message))
      .finally(() => active && setAttendanceLoading(false));
    return () => { active = false; };
  }, [classId, sessionId]);

  const selectedSession = sessions.find((session) => String(session.session_id) === sessionId);
  const counts = useMemo(() => Object.values(attendance).reduce((result, status) => {
    result[status] += 1;
    return result;
  }, { present: 0, absent: 0 }), [attendance]);
  function setStudentStatus(studentId, status) {
    setAttendance((current) => ({ ...current, [String(studentId)]: status }));
    setSaveMessage('');
  }

  async function saveAttendance() {
    if (!sessionId || !students.length) return;
    setSaving(true);
    setSaveMessage('');
    setLoadError('');
    try {
      await api.post(`/sessions/${sessionId}/attendance`, {
        attendance: students.map((student) => ({
          student_id: student.student_id,
          status: attendance[String(student.student_id)],
        })),
      });
      setSaveMessage(`Đã lưu điểm danh cho ${students.length} học sinh.`);
    } catch (requestError) {
      setLoadError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-flow attendance-page">
      <PageHeader title="Điểm danh" description="Tất cả học sinh mặc định có mặt. Chỉ cần đánh dấu những em vắng rồi lưu." />

      {classesLoading && <LoadingState rows={3} />}
      {classesError && <ErrorState message={classesError} onRetry={refreshClasses} />}
      {classes && (
        <section className="attendance-context" aria-label="Chọn lớp và buổi học">
          <Field label="Lớp học" required>
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">Chọn lớp học</option>
              {classes.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_code} - {item.class_name}</option>)}
            </Select>
          </Field>
          <Field label="Buổi học" required>
            <Select value={sessionId} disabled={!classId || sessionsLoading} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">Chọn buổi học</option>
              {sessions.map((session) => (
                <option key={session.session_id} value={session.session_id}>
                  {formatDate(session.session_date)}{session.start_time ? `, ${formatTime(session.start_time)}` : ''}{session.topic ? `, ${session.topic}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="attendance-session-summary">
            <span>Buổi đang chọn</span>
            <strong>{selectedSession ? formatDate(selectedSession.session_date) : 'Chưa chọn'}</strong>
          </div>
        </section>
      )}

      {(sessionsLoading || attendanceLoading) && <LoadingState rows={5} />}
      {loadError && <ErrorState message={loadError} />}
      {classId && !sessionsLoading && !sessions.length && !loadError && (
        <EmptyState title="Lớp chưa có buổi học" description="Hãy tạo buổi học trong lịch trước khi thực hiện điểm danh." />
      )}

      {sessionId && !attendanceLoading && !loadError && (
        <section className="attendance-surface" aria-label="Danh sách điểm danh">
          <div className="attendance-summary" aria-label="Tổng hợp điểm danh">
            <span><strong>{counts.present}</strong> có mặt</span>
            <span><strong>{counts.absent}</strong> vắng mặt</span>
          </div>

          {!students.length && <EmptyState title="Lớp chưa có học sinh" description="Chỉ học sinh đang học mới xuất hiện trong danh sách điểm danh." />}
          {students.length > 0 && (
            <div className="attendance-list">
              <div className="attendance-list-header" aria-hidden="true">
                <span>Học sinh</span>
                <span>Có mặt</span>
                <span>Vắng mặt</span>
              </div>
              {students.map((student) => {
                const studentId = String(student.student_id);
                const status = attendance[studentId];
                return (
                  <div className={`attendance-row attendance-row--${status}`} key={studentId}>
                    <div className="attendance-student-cell">
                      <span className="initial-tile">{student.full_name.slice(0, 1)}</span>
                      <div className="attendance-student"><strong>{student.full_name}</strong><span>{student.student_code}</span></div>
                    </div>
                    <div className="attendance-choice attendance-choice--present">
                      <Radio
                        name={`attendance-${studentId}`}
                        checked={status === 'present'}
                        aria-label={`${student.full_name} có mặt`}
                        onChange={() => setStudentStatus(studentId, 'present')}
                      />
                    </div>
                    <div className="attendance-choice attendance-choice--absent">
                      <Radio
                        name={`attendance-${studentId}`}
                        checked={status === 'absent'}
                        aria-label={`${student.full_name} vắng mặt`}
                        onChange={() => setStudentStatus(studentId, 'absent')}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {saveMessage && <MessageBar intent="success"><MessageBarBody>{saveMessage}</MessageBarBody></MessageBar>}
          <div className="attendance-save-bar">
            <span>Học sinh chưa có dữ liệu trước đó được mặc định là có mặt.</span>
            <Button appearance="primary" icon={<Save24Regular />} disabled={saving || !students.length} onClick={saveAttendance}>{saving ? 'Đang lưu...' : 'Lưu điểm danh'}</Button>
          </div>
        </section>
      )}
    </div>
  );
}
