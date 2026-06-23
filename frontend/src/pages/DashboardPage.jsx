import { Button } from '@fluentui/react-components';
import { ArrowRight24Regular, BookOpen24Filled, CalendarLtr24Regular, Money24Regular, PeopleCommunity24Regular, WindowApps24Regular } from '@fluentui/react-icons';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/FeedbackState';
import StatusBadge from '../components/StatusBadge';
import { usePageData } from '../hooks/usePageData';
import { dayLabels, formatCurrency, formatTime } from '../utils/format';

function timetablePath(user) {
  if (user.role === 'teacher') return `/timetable/teacher/${user.teacher_id}`;
  if (user.role === 'student') return `/timetable/student/${user.student_id}`;
  if (user.role === 'parent') return `/timetable/parent/${user.parent_id}`;
  return '/timetable';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = usePageData(async () => {
    const requests = [api.get('/classes?limit=100'), api.get(timetablePath(user))];
    if (['admin', 'staff', 'teacher'].includes(user.role)) requests.push(api.get('/students?limit=100'));
    if (['admin', 'staff'].includes(user.role)) requests.push(api.get('/invoices?limit=100'));
    const [classes, timetable, students, invoices] = await Promise.all(requests);
    return {
      classes: classes.data.items,
      timetable: timetable.data,
      students: students?.data?.items || [],
      invoices: invoices?.data?.items || [],
    };
  }, [user.role]);

  const firstName = user.full_name?.split(' ').slice(-1)[0] || 'bạn';

  return (
    <div className="page-flow">
      <section className="welcome-strip">
        <div><span>Chào buổi học mới, {firstName}</span><h1>Mọi thứ đang đi đúng nhịp.</h1><p>Xem nhanh lớp học, lịch dạy và những việc cần chú ý hôm nay.</p></div>
        <div className="welcome-strip__stamp"><BookStamp /></div>
      </section>

      {loading && <LoadingState rows={5} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {data && (
        <>
          <section className="stat-grid" aria-label="Số liệu tổng quan">
            <Stat icon={WindowApps24Regular} value={data.classes.length} label="Lớp đang theo dõi" tone="blue" />
            <Stat icon={PeopleCommunity24Regular} value={data.students.length || 'Theo lớp'} label="Học sinh" tone="yellow" />
            <Stat icon={CalendarLtr24Regular} value={data.timetable.length} label="Lịch học mỗi tuần" tone="blue" />
            <Stat icon={Money24Regular} value={data.invoices.filter((item) => item.status === 'unpaid').length || 0} label="Hóa đơn cần nhắc" tone="yellow" />
          </section>

          <section className="dashboard-grid">
            <div className="surface schedule-preview">
              <div className="surface-heading"><div><span>Thời khóa biểu</span><h2>Nhịp học trong tuần</h2></div><Button as={Link} to="/timetable" appearance="subtle" icon={<ArrowRight24Regular />} iconPosition="after">Xem tất cả</Button></div>
              {data.timetable.length ? data.timetable.slice(0, 5).map((item) => (
                <div className="schedule-row" key={`${item.class_id}-${item.day_of_week}-${item.start_time}`}>
                  <div className="schedule-row__day"><strong>{dayLabels[item.day_of_week]}</strong><span>{formatTime(item.start_time)}</span></div>
                  <div><strong>{item.class_name}</strong><span>{item.teacher_name || item.subject_name}</span></div>
                  <span className="room-chip">{item.room_name || 'Chưa xếp phòng'}</span>
                </div>
              )) : <EmptyState title="Tuần này chưa có lịch" description="Lịch học được tạo sẽ xuất hiện tại đây." />}
            </div>

            <div className="surface class-preview">
              <div className="surface-heading"><div><span>Lớp học</span><h2>Danh sách gần đây</h2></div></div>
              {data.classes.slice(0, 4).map((item) => (
                <div className="class-row" key={item.class_id}><span className="class-code">{item.class_code}</span><div><strong>{item.class_name}</strong><span>{formatCurrency(item.tuition_fee)} mỗi khóa</span></div><StatusBadge status={item.status} /></div>
              ))}
              {!data.classes.length && <EmptyState title="Chưa có lớp học" />}
              <Button as={Link} to="/classes" appearance="secondary" className="surface-action">Mở danh sách lớp</Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, value, label, tone }) {
  return <div className={`stat-block stat-block--${tone}`}><span><Icon /></span><strong>{value}</strong><p>{label}</p></div>;
}

function BookStamp() {
  return <div className="book-stamp"><BookOpen24FilledFallback /><span>Hôm nay</span></div>;
}

function BookOpen24FilledFallback() { return <BookOpen24Filled />; }
