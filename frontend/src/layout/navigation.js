import {
  CalendarLtr24Regular,
  DataTrending24Regular,
  Home24Regular,
  MailTemplate24Regular,
  PeopleCheckmark24Regular,
  PeopleCommunity24Regular,
  Person24Regular,
  PersonCircle24Regular,
  WindowApps24Regular,
  Building24Regular
} from '../components/bootstrap-icons';

export const navItems = [
  { to: '/', label: 'Tổng quan', icon: Home24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'], end: true },
  { to: '/rooms', label: 'Phòng học', icon: Building24Regular, roles: ['admin'] },
  { to: '/teachers', label: 'Giáo viên', icon: Person24Regular, roles: ['admin'] },
  { to: '/accounts', label: 'Tài khoản', icon: Person24Regular, roles: ['admin'] },
  { to: '/students', label: 'Học sinh', icon: PeopleCommunity24Regular, roles: ['admin', 'staff', 'teacher'] },
  { to: '/classes', label: 'Lớp học', icon: WindowApps24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'] },
  { to: '/timetable', label: 'Thời khóa biểu', icon: CalendarLtr24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'] },
  { to: '/attendance', label: 'Điểm danh', icon: PeopleCheckmark24Regular, roles: ['admin', 'teacher'] },
  { to: '/attendance-history', label: 'Lịch sử điểm danh', icon: DataTrending24Regular, roles: ['admin', 'teacher'] },
  { to: '/parent-notifications', label: 'Thông báo phụ huynh', icon: MailTemplate24Regular, roles: ['admin', 'staff', 'teacher'] },
  { to: '/learning-history', label: 'Quá trình học tập', icon: DataTrending24Regular, roles: ['admin', 'teacher'] },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: PersonCircle24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'] },
];
