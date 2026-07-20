import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { ToastProvider } from './components/ToastProvider';
import { ApplicantDashboard } from './pages/ApplicantDashboard';
import { ApplicantProfilePage } from './pages/ApplicantProfilePage';
import { ApplicationConfirmationPage } from './pages/ApplicationConfirmationPage';
import { ApplicationDetailsPage } from './pages/ApplicationDetailsPage';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage';
import { CertificateViewPage } from './pages/CertificateViewPage';
import { DocumentUploadPage } from './pages/DocumentUploadPage';
import { MapPage } from './pages/MapPage';
import { MySurveyTasksPage } from './pages/MySurveyTasksPage';
import { RoleUnavailablePage } from './pages/RoleUnavailablePage';
import { StaffApplicationDetailsPage } from './pages/StaffApplicationDetailsPage';
import { StaffDashboardPage } from './pages/StaffDashboardPage';
import { SubmitApplicationPage } from './pages/SubmitApplicationPage';
import { SubmitObjectionPage } from './pages/SubmitObjectionPage';
import { SurveyTaskDetailsPage } from './pages/SurveyTaskDetailsPage';
import { TrackApplicationPage } from './pages/TrackApplicationPage';
import { UserSelectionPage } from './pages/UserSelectionPage';

function AppShell({
  children,
  applicantOnly = true,
  allowedRoles,
  sidebarVariant,
}: {
  children: React.ReactNode;
  applicantOnly?: boolean;
  allowedRoles?: string[];
  sidebarVariant?: 'applicant' | 'staff' | 'surveyor';
}) {
  const effectiveSidebar = sidebarVariant ?? (applicantOnly ? 'applicant' : undefined);
  return (
    <ProtectedRoute allowedRoles={allowedRoles ?? (applicantOnly ? ['applicant'] : undefined)}>
      <div className="app-frame">
        {effectiveSidebar && <Sidebar variant={effectiveSidebar} />}
        <div className="app-content">
          <Navbar />
          <main className="app-main">{children}</main>
          <Footer />
        </div>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UserSelectionPage />} />
          <Route path="/applicant-dashboard" element={<AppShell><ApplicantDashboard /></AppShell>} />
          <Route path="/applicant-profile" element={<AppShell><ApplicantProfilePage /></AppShell>} />
          <Route path="/submit-application" element={<AppShell><SubmitApplicationPage /></AppShell>} />
          <Route path="/application-confirmation/:applicationId" element={<AppShell><ApplicationConfirmationPage /></AppShell>} />
          <Route path="/track-application" element={<AppShell><TrackApplicationPage /></AppShell>} />
          <Route path="/upload-documents" element={<AppShell><DocumentUploadPage /></AppShell>} />
          <Route path="/submit-objection" element={<AppShell><SubmitObjectionPage /></AppShell>} />
          <Route path="/applications/:applicationId" element={<AppShell><ApplicationDetailsPage /></AppShell>} />
          <Route path="/applications/:applicationId/certificates" element={<AppShell><CertificateViewPage /></AppShell>} />
          <Route
            path="/staff-dashboard"
            element={<AppShell applicantOnly={false} allowedRoles={['staff', 'registrar', 'manager', 'admin']} sidebarVariant="staff"><StaffDashboardPage /></AppShell>}
          />
          <Route
            path="/staff/applications/:applicationId"
            element={<AppShell applicantOnly={false} allowedRoles={['staff', 'registrar', 'manager', 'admin']} sidebarVariant="staff"><StaffApplicationDetailsPage /></AppShell>}
          />
          <Route
            path="/analytics"
            element={<AppShell applicantOnly={false} allowedRoles={['staff', 'registrar', 'manager', 'admin']} sidebarVariant="staff"><AnalyticsDashboardPage /></AppShell>}
          />
          <Route
            path="/map"
            element={<AppShell applicantOnly={false} allowedRoles={['staff', 'registrar', 'manager', 'admin']} sidebarVariant="staff"><MapPage /></AppShell>}
          />
          <Route
            path="/my-survey-tasks"
            element={<AppShell applicantOnly={false} allowedRoles={['surveyor']} sidebarVariant="surveyor"><MySurveyTasksPage /></AppShell>}
          />
          <Route
            path="/survey-tasks/:applicationId"
            element={<AppShell applicantOnly={false} allowedRoles={['surveyor']} sidebarVariant="surveyor"><SurveyTaskDetailsPage /></AppShell>}
          />
          <Route path="/role-unavailable/:role" element={<AppShell applicantOnly={false}><RoleUnavailablePage /></AppShell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
