import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../../api';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}
