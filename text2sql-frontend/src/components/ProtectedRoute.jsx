import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useSelector((state) => state.auth);

  // 1. If still checking the token, show nothing (or a loader)
  if (isLoading) return null;

  // 2. If not authenticated, kick them to the login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. If authenticated, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;
