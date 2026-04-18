/**
 * ProtectedRoute.tsx
 * Wraps any route that requires authentication.
 * If no token is found in localStorage, redirects to /login.
 */
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const token = localStorage.getItem('access_token');

  // If no token exists, redirect to login immediately
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Token exists — render the child route
  return <Outlet />;
}