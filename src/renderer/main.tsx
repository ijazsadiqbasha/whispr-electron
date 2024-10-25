import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from '../components/ThemeProvider.js';
import Settings from '../pages/Settings.js';
import Overlay from '../pages/Overlay.js';
import './globals.css';

const AppContent = () => {
  const location = useLocation();

  useEffect(() => {
    const isOverlay = location.pathname === '/overlay';
    document.body.classList.toggle('overlay', isOverlay);
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.classList.toggle('overlay', isOverlay);
    }
  }, [location]);

  return (
    <Routes>
      <Route path="/" element={
        <>
          <div className="titlebar" />
          <div className="min-h-screen bg-background text-foreground p-4">
            <Settings />
          </div>
        </>
      } />
      <Route path="/overlay" element={<Overlay />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
};

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Root element not found');
}
