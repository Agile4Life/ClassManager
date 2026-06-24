import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import AppShell from './layout/AppShell';
import { LoadingState } from './components/FeedbackState';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const ClassesPage = lazy(() => import('./pages/ClassesPage'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ParentNotificationPage = lazy(() => import('./pages/ParentNotificationPage'));

export default function App() {
  return (
    <Suspense fallback={<div className="route-loader"><LoadingState rows={5} /></div>}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="parent-notifications" element={<ParentNotificationPage />} />
        </Route>
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense>
  );
}
