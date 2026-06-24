import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton, SkeletonItem } from '../components/bootstrap-ui';
import { useAuth } from './AuthContext';

export default function ProtectedRoute() {
  const { user, checkingSession } = useAuth();
  const location = useLocation();

  if (checkingSession && !user) {
    return (
      <div className="session-loader" aria-label="Đang kiểm tra phiên đăng nhập">
        <Skeleton><SkeletonItem shape="rectangle" className="session-loader__bar" /></Skeleton>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
