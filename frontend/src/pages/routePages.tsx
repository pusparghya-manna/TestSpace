import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import type { DashboardOutletContext } from '../components/layout/DashboardLayout';
import { Home } from './Home';
import { Exams } from './Exams';
import { Results } from './Results';
import { Settings } from './Settings';
import { effectiveExamStatus } from '../lib/examStatus';

export function HomePage() {
  const { exams, students, attempts } = useOutletContext<DashboardOutletContext>();
  const navigate = useNavigate();
  const live = exams.filter((e) => effectiveExamStatus(e) === 'LIVE').length;
  const done = attempts.filter((a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED').length;
  return (
    <Home
      exams={exams.length}
      live={live}
      submissions={done}
      students={students}
      attempts={attempts}
      examList={exams}
      onExams={() => navigate('/exams/new')}
    />
  );
}

export function ExamsPage() {
  const { exams, settings, onRefresh } = useOutletContext<DashboardOutletContext>();
  const loc = useLocation();
  const openNew = loc.pathname.endsWith('/new');
  return (
    <Exams
      exams={exams}
      botUsername={settings.botUsername}
      onRefresh={onRefresh}
      defaultOpenNew={openNew}
    />
  );
}

export function ResultsPage() {
  const { exams, attempts, students, onRefresh } = useOutletContext<DashboardOutletContext>();
  return <Results exams={exams} attempts={attempts} students={students} onRefresh={onRefresh} />;
}

export function SettingsPage() {
  const { settings, logs, onRefresh } = useOutletContext<DashboardOutletContext>();
  return <Settings settings={settings} logs={logs} onRefresh={onRefresh} />;
}
