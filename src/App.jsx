"use client";
import { useLocation, Navigate } from "lib/navigation";
import AdminLayout from "layouts/admin";
import LoginEntry from "components/Login/LoginEntry";
import { AuthProvider, RequireLogin } from "./contexts/AuthContext";
export default function App() {
  const { pathname } = useLocation();
  return (
    <AuthProvider>
      {pathname === "/login" ? (
        <LoginEntry />
      ) : pathname === "/admin" || pathname.startsWith("/admin/") ? (
        <RequireLogin>
          <AdminLayout />
        </RequireLogin>
      ) : (
        <Navigate to="/login" />
      )}
    </AuthProvider>
  );
}
