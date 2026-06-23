import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import PageHeader from '../components/PageHeader';
import { usePageData } from '../hooks/usePageData';

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

  return <div className="page-flow"><PageHeader title="Báo cáo học tập" description="Nhìn ra chủ đề cần hỗ trợ để mỗi bạn tiến bộ đúng chỗ." />
    {loading && <LoadingState rows={7} />}{error && <ErrorState message={error} onRetry={refresh} />}{data && !data.length && <EmptyState title="Chưa có chủ đề cần lưu ý" description="Kết quả bài tập được chấm sẽ tạo dữ liệu báo cáo." />}
    {data?.length > 0 && <div className="report-layout"><div className="report-summary"><span>Điểm cần chú ý</span><strong>{data.length}</strong><p>chủ đề đang dưới mức thành thạo 60%</p></div><div className="table-surface"><Table aria-label="Chủ đề học sinh còn yếu"><TableHeader><TableRow><TableHeaderCell>Học sinh</TableHeaderCell><TableHeaderCell>Lớp học</TableHeaderCell><TableHeaderCell>Môn học</TableHeaderCell><TableHeaderCell>Chủ đề</TableHeaderCell><TableHeaderCell>Mức thành thạo</TableHeaderCell></TableRow></TableHeader><TableBody>{data.map((item) => <TableRow key={`${item.student_id}-${item.class_id}-${item.topic_id}`}><TableCell><strong>{item.student_name}</strong></TableCell><TableCell>{item.class_name}</TableCell><TableCell>{item.subject_name}</TableCell><TableCell>{item.topic_name}</TableCell><TableCell><span className="mastery-value">{Number(item.mastery_percent).toFixed(0)}%</span></TableCell></TableRow>)}</TableBody></Table></div></div>}
  </div>;
}
