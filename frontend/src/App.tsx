import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './components/Login';
import { getToken } from './api';
import { NotFound } from './pages/NotFound';
import { ContactPage, PageMeta, PrivacyPage, TermsPage, ThankYouPage } from './pages/PublicInfo';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/AuthRecovery';
import TelegramReview from './pages/TelegramReview';
import { HomeSkeleton } from './components/ui/HomeSkeleton';

const HomePage = lazy(() => import('./pages/routePages').then((m) => ({ default: m.HomePage })));
const ExamsPage = lazy(() => import('./pages/routePages').then((m) => ({ default: m.ExamsPage })));
const ResultsPage = lazy(() => import('./pages/routePages').then((m) => ({ default: m.ResultsPage })));
const SettingsPage = lazy(() => import('./pages/routePages').then((m) => ({ default: m.SettingsPage })));

function LoginRoute() {
  const navigate = useNavigate();
  const loc = useLocation();
  if (getToken()) {
    const dest = (loc.state as { from?: string } | null)?.from || '/';
    return <Navigate to={dest} replace />;
  }
  return (
    <Login
      onOk={() => {
        const dest = (loc.state as { from?: string } | null)?.from || '/';
        navigate(dest, { replace: true });
      }}
    />
  );
}

function LazyFallback() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      <HomeSkeleton />
    </div>
  );
}

/**
 * Route table only — BrowserRouter lives once in main.tsx.
 * Paths are absolute so nested layout does not drop the URL segment.
 */
export default function App() {
  return (
    <>
      <PageMeta />
      <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/review" element={<TelegramReview />} />

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/exams/new" element={<ExamsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
}
