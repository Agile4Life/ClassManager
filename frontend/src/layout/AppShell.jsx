import { useEffect, useState } from 'react';
import { Avatar, Button } from '@fluentui/react-components';
import {
  BookOpen24Filled, CalendarLtr24Regular, DataTrending24Regular, Dismiss24Regular,
  Home24Regular, MailTemplate24Regular, Navigation24Regular, PeopleCommunity24Regular,
  PeopleCheckmark24Regular, SignOut24Regular, WindowApps24Regular, Person24Regular
} from '@fluentui/react-icons';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const roleLabels = { admin: 'Quản trị viên', staff: 'Nhân viên', teacher: 'Giáo viên', student: 'Học sinh', parent: 'Phụ huynh' };

const navItems = [
  { to: '/', label: 'Tổng quan', icon: Home24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'], end: true },
  { to: '/teachers', label: 'Giáo viên', icon: Person24Regular, roles: ['admin'] },
  { to: '/accounts', label: 'Tài khoản', icon: Person24Regular, roles: ['admin'] },
  { to: '/students', label: 'Học sinh', icon: PeopleCommunity24Regular, roles: ['admin', 'staff', 'teacher'] },
  { to: '/classes', label: 'Lớp học', icon: WindowApps24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'] },
  { to: '/timetable', label: 'Thời khóa biểu', icon: CalendarLtr24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'] },
  { to: '/attendance', label: 'Điểm danh', icon: PeopleCheckmark24Regular, roles: ['admin', 'teacher'] },
  { to: '/reports', label: 'Báo cáo học tập', icon: DataTrending24Regular, roles: ['admin', 'staff', 'teacher', 'student', 'parent'] },
  { to: '/parent-notifications', label: 'Thông báo phụ huynh', icon: MailTemplate24Regular, roles: ['admin', 'staff', 'teacher'] },
  { to: '/learning-history', label: 'Quá trình học tập', icon: DataTrending24Regular, roles: ['admin', 'teacher'] },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="app-shell">
      {menuOpen && <button className="sidebar-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="brand-lockup">
          <span className="brand-lockup__mark"><BookOpen24Filled /></span>
          <div><strong>ClassManager</strong><span>Học tốt mỗi ngày</span></div>
          <Button className="sidebar__close" appearance="subtle" icon={<Dismiss24Regular />} aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
        </div>

        <nav className="primary-nav" aria-label="Điều hướng chính">
          {navItems.filter((item) => item.roles.includes(user.role)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-note">
          <span>Góc nhắc nhỏ</span>
          <strong>Mỗi buổi học đều đáng được ghi nhận.</strong>
        </div>

        <div className="sidebar-user">
          <Avatar name={user.full_name} color="colorful" />
          <div><strong>{user.full_name}</strong><span>{roleLabels[user.role] || user.role}</span></div>
          <Button
            className="sidebar-logout"
            type="button"
            appearance="subtle"
            icon={<SignOut24Regular />}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={logout}
          />
        </div>
      </aside>

      <main className="main-stage">
        <div className="mobile-topbar">
          <Button appearance="subtle" icon={<Navigation24Regular />} aria-label="Mở menu" onClick={() => setMenuOpen(true)} />
          <span><BookOpen24Filled /> ClassManager</span>
          <Avatar size={28} name={user.full_name} color="colorful" />
        </div>
        <div className="page-container"><Outlet /></div>
      </main>
    </div>
  );
}
