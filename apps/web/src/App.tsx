import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/auth/route-guards";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import LandingPage from "@/pages/landing";

const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const BudgetsPage = lazy(() => import("@/pages/budgets"));
const CategoriesPage = lazy(() => import("@/pages/categories"));
const CopilotPage = lazy(() => import("@/pages/copilot"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const GoalsPage = lazy(() => import("@/pages/goals"));
const LoginPage = lazy(() => import("@/pages/login"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const RegisterPage = lazy(() => import("@/pages/register"));
const TransactionsPage = lazy(() => import("@/pages/transactions"));

function RouteFallback() {
  return (
    <main
      id="main"
      className="flex min-h-dvh items-center justify-center bg-background"
      aria-busy="true"
    >
      <div role="status" aria-label="Loading page">
        <div className="flex flex-col items-center gap-3">
          <span className="size-7 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-xs text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/copilot" element={<CopilotPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
