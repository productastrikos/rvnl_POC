import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './services/socket';
import { Chart as ChartJS } from 'chart.js';

import Layout from './components/Layout';

/* Command */
import Dashboard from './pages/Dashboard';
import DigitalTwin from './pages/DigitalTwin';
import Portfolio from './pages/Portfolio';
import ProjectDetail from './pages/ProjectDetail';

/* Commercial */
import Finance from './pages/Finance';
import Billing from './pages/Billing';
import Procurement from './pages/Procurement';
import Contractors from './pages/Contractors';

/* Governance */
import Approvals from './pages/Approvals';
import Audit from './pages/Audit';

/* Knowledge */
import Documents from './pages/Documents';
import Assistant from './pages/Assistant';
import Reports from './pages/Reports';

ChartJS.defaults.interaction.mode = 'index';
ChartJS.defaults.interaction.intersect = false;
ChartJS.defaults.plugins.tooltip.enabled = true;
ChartJS.defaults.font.family = 'Inter, sans-serif';

/* Everything that used to live on its own page and is now a twin layer. */
const TWIN_REDIRECTS = ['/map', '/land', '/compliance', '/safety', '/risks', '/milestones', '/resources', '/construction', '/field'];

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  return (
    <SocketProvider>
      {/* basename tracks PUBLIC_URL so the same build works at the domain root
          or inside a subfolder (see PUBLIC_URL in client/.env.production). */}
      <Router basename={process.env.PUBLIC_URL || '/'}>
        <Layout theme={theme} onThemeToggle={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
          <Routes>
            {/* Command */}
            <Route path="/"                element={<Dashboard />} />
            <Route path="/twin"            element={<DigitalTwin />} />
            <Route path="/portfolio"       element={<Portfolio />} />
            <Route path="/projects/:id"    element={<ProjectDetail />} />

            {/* Commercial */}
            <Route path="/finance"         element={<Finance />} />
            <Route path="/billing"         element={<Billing />} />
            <Route path="/procurement"     element={<Procurement />} />
            <Route path="/contractors"     element={<Contractors />} />

            {/* Governance */}
            <Route path="/approvals"       element={<Approvals />} />
            <Route path="/audit"           element={<Audit />} />

            {/* Knowledge */}
            <Route path="/documents"       element={<Documents />} />
            <Route path="/assistant"       element={<Assistant />} />
            <Route path="/reports"         element={<Reports />} />

            {/* Folded into the digital twin */}
            {TWIN_REDIRECTS.map(path => (
              <Route key={path} path={path} element={<Navigate to="/twin" replace />} />
            ))}

            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </SocketProvider>
  );
}
