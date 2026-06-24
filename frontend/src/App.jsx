import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import AppShell from './layout/AppShell';
import { LoadingState } from './components/FeedbackState';
import ErrorBoundary from './components/ErrorBoundary';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TeachersPage = lazy(() => import('./pages/TeachersPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const ClassesPage = lazy(() => import('./pages/ClassesPage'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));
const ParentNotificationPage = lazy(() => import('./pages/ParentNotificationPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const LearningHistoryPage = lazy(() => import('./pages/LearningHistoryPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));

export default function App() {
  return (
    <ErrorBoundary><Suspense fallback={<div className="route-loader"><LoadingState rows={5} /></div>}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="teachers" element={<TeachersPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="finance" element={<Navigate to="/" replace />} />
          <Route path="reports" element={<Navigate to="/learning-history" replace />} />
          <Route path="parent-notifications" element={<ParentNotificationPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="learning-history" element={<LearningHistoryPage />} />
          <Route path="accounts" element={<AccountsPage />} />
        </Route>
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense></ErrorBoundary>
  );
}
