import { useEffect, useState } from 'react';
import {
  Badge, Field, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, MessageBar, MessageBarBody
} from '../components/bootstrap-ui';
import { Delete24Regular } from '../components/bootstrap-icons';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { usePageData } from '../hooks/usePageData';

const allowedRoles = ['admin', 'teacher'];
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short',
});

export default function LearningHistoryPage() {
  const { user } = useAuth();
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <LearningHistoryWorkspace user={user} />;
}

function LearningHistoryWorkspace({ user }) {
  const [page, setPage] = useState(1);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data: classes, loading: classesLoading, error: classesError, refresh: refreshClasses } = usePageData(
    () => api.get('/classes?limit=100').then((response) => response.data.items),
    [user.role],
  );
  const { data, loading, error, refresh } = usePageData(
    () => api.get(`/learning-history?page=${page}&limit=15&class_id=${classId}&student_id=${studentId}`).then((response) => response.data),
    [page, classId, studentId],
  );

  useEffect(() => {
    setStudentId('');
    setPage(1);
    if (!classId) {
      setStudents([]);
      setStudentsError('');
      return undefined;
    }
    let active = true;
    setStudentsLoading(true);
    setStudentsError('');
    api.get(`/classes/${classId}/students`)
      .then((response) => active && setStudents(response.data))
      .catch((requestError) => active && setStudentsError(requestError.message))
      .finally(() => active && setStudentsLoading(false));
    return () => { active = false; };
  }, [classId]);

  const summary = data?.summary || { total_events: 0, students_count: 0 };

  async function deleteEvent() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/learning-history/${deleteTarget.event_id}`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-flow learning-history-page">
      <PageHeader
        title="Quá trình học tập"
        description="Theo dõi từng mục đã nhắc phụ huynh và phát hiện những vấn đề lặp lại cần hỗ trợ."
      />

      <section className="learning-history-filters" aria-label="Bộ lọc quá trình học tập">
        <Field label="Lớp học">
          <Select value={classId} disabled={classesLoading} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Tất cả lớp học</option>
            {classes?.map((item) => <option key={item.class_id} value={item.class_id}>{item.class_code} - {item.class_name}</option>)}
          </Select>
        </Field>
        <Field label="Học sinh">
          <Select
            value={studentId}
            disabled={!classId || studentsLoading}
            onChange={(event) => { setStudentId(event.target.value); setPage(1); }}
          >
            <option value="">Tất cả học sinh</option>
            {students.map((student) => <option key={student.student_id} value={student.student_id}>{student.student_code} - {student.full_name}</option>)}
          </Select>
        </Field>
      </section>

      {classesError && <ErrorState message={classesError} onRetry={refreshClasses} />}
      {studentsError && <ErrorState message={studentsError} />}
      <section className="learning-history-summary" aria-label="Tổng hợp quá trình học tập">
        <div><span>Lượt ghi nhận</span><strong>{summary.total_events}</strong></div>
        <div><span>Học sinh được theo dõi</span><strong>{summary.students_count}</strong></div>
      </section>

      {loading && <LoadingState rows={7} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data && !data.items.length && !loading && (
        <EmptyState title="Chưa có lịch sử học tập" description="Các mục đánh dấu trong Thông báo phụ huynh sẽ xuất hiện tại đây sau khi được lưu và sao chép hoặc in." />
      )}
      {data?.items.length > 0 && (
        <div className="table-surface learning-history-table">
          <Table aria-label="Lịch sử quá trình học tập">
            <TableHeader><TableRow>
              <TableHeaderCell>Thời gian</TableHeaderCell>
              <TableHeaderCell>Học sinh</TableHeaderCell>
              <TableHeaderCell>Mục được đánh dấu</TableHeaderCell>
              <TableHeaderCell>Số lần</TableHeaderCell>
              <TableHeaderCell>Người ghi nhận</TableHeaderCell>
              {user.role === 'admin' && <TableHeaderCell>Thao tác</TableHeaderCell>}
            </TableRow></TableHeader>
            <TableBody>{data.items.map((item) => (
                <TableRow key={item.event_id}>
                  <TableCell><div className="stacked-cell"><span>{dateTimeFormatter.format(new Date(item.created_at))}</span><small>{item.class_code || 'Lớp đã xóa'}</small></div></TableCell>
                  <TableCell><div className="stacked-cell"><strong>{item.student_name}</strong><small>{item.student_code}</small></div></TableCell>
                  <TableCell><div className="learning-history-detail"><strong>{item.category_label}</strong><span>{item.detail}</span>{item.student_note && <small>Ghi chú: {item.student_note}</small>}</div></TableCell>
                  <TableCell><Badge appearance="filled" color="informative">{item.occurrence_count} lần</Badge></TableCell>
                  <TableCell><div className="stacked-cell"><span>{item.recorded_by_name || item.teacher_name || 'Tài khoản đã xóa'}</span><small>{item.teacher_name || 'Chưa phân công'}</small></div></TableCell>
                  {user.role === 'admin' && (
                    <TableCell>
                      <Button appearance="subtle" size="small" icon={<Delete24Regular />} aria-label="Xóa" title="Xóa ghi nhận" onClick={() => { setDeleteTarget(item); setDeleteError(''); }} />
                    </TableCell>
                  )}
                </TableRow>
            ))}</TableBody>
          </Table>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(_, details) => { if (!details.open && !deleting) setDeleteTarget(null); }}>
        <DialogSurface><DialogBody>
          <DialogTitle>Xóa lịch sử ghi nhận?</DialogTitle>
          <DialogContent>
            {deleteError && <MessageBar intent="error"><MessageBarBody>{deleteError}</MessageBarBody></MessageBar>}
            <p>Hành động này sẽ xóa ghi nhận <strong>{deleteTarget?.category_label}</strong> của học sinh <strong>{deleteTarget?.student_name}</strong> và không thể hoàn tác.</p>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button className="danger-button" appearance="primary" disabled={deleting} onClick={deleteEvent}>{deleting ? 'Đang xóa...' : 'Xóa ghi nhận'}</Button>
          </DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </div>
  );
}
