import { Badge, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';
import { formatDate } from '../utils/format';

export default function ReportsPage() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = usePageData(async () => {
    if (['admin', 'staff', 'teacher'].includes(user.role)) {
      const response = await api.get('/reports/weak-topics');
      return response.data;
    }
    if (user.role === 'student') {
      const response = await api.get(`/reports/student/${user.student_id}/weak-topics`);
      return response.data;
    }
    const timetable = await api.get(`/timetable/parent/${user.parent_id}`);
    const studentIds = [...new Set(timetable.data.map((item) => item.student_id))];
    const responses = await Promise.all(studentIds.map((id) => api.get(`/reports/student/${id}/weak-topics`)));
    return responses.flatMap((response) => response.data);
  }, [user.role]);
  const canViewLearningAlerts = ['admin', 'teacher'].includes(user.role);
  const { data: learningAlerts, loading: alertsLoading, error: alertsError, refresh: refreshAlerts } = usePageData(
    () => (canViewLearningAlerts
      ? api.get('/reports/learning-history-alerts').then((response) => response.data)
      : Promise.resolve([])),
    [user.role],
  );

  return <div className="page-flow"><PageHeader title="Báo cáo học tập" description="Nhìn ra chủ đề cần hỗ trợ để mỗi bạn tiến bộ đúng chỗ." />
    {canViewLearningAlerts && <section className="report-alert-section" aria-labelledby="repeated-alerts-title">
      <div className="report-section-heading"><div><h2 id="repeated-alerts-title">Cảnh báo lặp lại</h2><p>Tự động tạo khi một học sinh được ghi nhận từ lần thứ 4 trong cùng một mục.</p></div><Badge appearance="filled" color={learningAlerts?.length ? 'danger' : 'informative'}>{learningAlerts?.length || 0} cảnh báo</Badge></div>
      {alertsLoading && <LoadingState rows={3} />}
      {alertsError && <ErrorState message={alertsError} onRetry={refreshAlerts} />}
      {learningAlerts && !learningAlerts.length && !alertsLoading && <EmptyState title="Chưa có cảnh báo lặp lại" description="Những mục chưa vượt quá 3 lần vẫn được lưu tại trang Quá trình học tập." />}
      {learningAlerts?.length > 0 && <div className="table-surface"><Table aria-label="Cảnh báo học tập từ lịch sử"><TableHeader><TableRow><TableHeaderCell>Học sinh</TableHeaderCell><TableHeaderCell>Lớp học</TableHeaderCell><TableHeaderCell>Nội dung cảnh báo</TableHeaderCell><TableHeaderCell>Số lần</TableHeaderCell><TableHeaderCell>Ngày tạo</TableHeaderCell><TableHeaderCell>Trạng thái</TableHeaderCell></TableRow></TableHeader><TableBody>{learningAlerts.map((item) => <TableRow key={item.report_id}><TableCell><div className="stacked-cell"><strong>{item.student_name}</strong><small>{item.student_code}</small></div></TableCell><TableCell>{item.class_name || 'Chưa xác định'}</TableCell><TableCell>{item.weakness_summary}</TableCell><TableCell><Badge appearance="filled" color="danger">{item.occurrence_count} lần</Badge></TableCell><TableCell>{formatDate(item.created_at)}</TableCell><TableCell><Badge appearance="tint" color={item.status === 'sent' ? 'success' : 'warning'}>{item.status === 'sent' ? 'Đã gửi' : 'Bản nháp'}</Badge></TableCell></TableRow>)}</TableBody></Table></div>}
    </section>}
    {loading && <LoadingState rows={7} />}{error && <ErrorState message={error} onRetry={refresh} />}{data && !data.length && <EmptyState title="Chưa có chủ đề cần lưu ý" description="Kết quả bài tập được chấm sẽ tạo dữ liệu báo cáo." />}
    {data?.length > 0 && <div className="report-layout"><div className="report-summary"><span>Điểm cần chú ý</span><strong>{data.length}</strong><p>chủ đề đang dưới mức thành thạo 60%</p></div><div className="table-surface"><Table aria-label="Chủ đề học sinh còn yếu"><TableHeader><TableRow><TableHeaderCell>Học sinh</TableHeaderCell><TableHeaderCell>Lớp học</TableHeaderCell><TableHeaderCell>Môn học</TableHeaderCell><TableHeaderCell>Chủ đề</TableHeaderCell><TableHeaderCell>Mức thành thạo</TableHeaderCell></TableRow></TableHeader><TableBody>{data.map((item) => <TableRow key={`${item.student_id}-${item.class_id}-${item.topic_id}`}><TableCell><strong>{item.student_name}</strong></TableCell><TableCell>{item.class_name}</TableCell><TableCell>{item.subject_name}</TableCell><TableCell>{item.topic_name}</TableCell><TableCell><span className="mastery-value">{Number(item.mastery_percent).toFixed(0)}%</span></TableCell></TableRow>)}</TableBody></Table></div></div>}
  </div>;
}
