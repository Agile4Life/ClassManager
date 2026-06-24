import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import AppShell from './layout/AppShell';
import { LoadingState } from './components/FeedbackState';
import ErrorBoundary from './components/ErrorBoundary';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const ClassesPage = lazy(() => import('./pages/ClassesPage'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ParentNotificationPage = lazy(() => import('./pages/ParentNotificationPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));

export default function App() {
  return (
    <ErrorBoundary><Suspense fallback={<div className="route-loader"><LoadingState rows={5} /></div>}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="finance" element={<Navigate to="/" replace />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="parent-notifications" element={<ParentNotificationPage />} />
          <Route path="attendance" element={<AttendancePage />} />
        </Route>
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense></ErrorBoundary>
  );
}
