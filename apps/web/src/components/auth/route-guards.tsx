import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthLoading } from "@/components/auth/auth-loading";
import { readRedirectTarget } from "@/lib/redirect";
import { useAuth } from "@/providers/auth-provider";

/** Signed-out visitors are bounced to /login and returned after authentication. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <AuthLoading />;
  }

  if (status === "anonymous") {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}

/** Login and register are public-only; signed-in users land on their workspace. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <AuthLoading />;
  }

  if (status === "authenticated") {
    return <Navigate to={readRedirectTarget(location.state)} replace />;
  }

  return <Outlet />;
}
