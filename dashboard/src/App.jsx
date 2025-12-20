import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Messages from './pages/Messages';
import Webhooks from './pages/Webhooks';
import WebhookTester from './pages/WebhookTester';
import Settings from './pages/Settings';
import Events from './pages/Events';
import Workers from './pages/Workers';

// Simple auth using browser prompt
const checkAuth = () => {
  const authEnabled = import.meta.env.VITE_DASHBOARD_ENABLED === 'true';
  const username = import.meta.env.VITE_DASHBOARD_USERNAME;
  const password = import.meta.env.VITE_DASHBOARD_PASSWORD;
  
  // If auth not enabled or no credentials set, allow access
  if (!authEnabled || !username || !password) {
    return true;
  }
  
  // Check if already authenticated in session
  if (sessionStorage.getItem('dashboard_auth') === 'true') {
    return true;
  }
  
  // Prompt for credentials
  const inputUser = prompt('Dashboard Login\n\nUsername:');
  if (!inputUser) return false;
  
  const inputPass = prompt('Password:');
  if (!inputPass) return false;
  
  if (inputUser === username && inputPass === password) {
    sessionStorage.setItem('dashboard_auth', 'true');
    return true;
  }
  
  alert('Invalid credentials!');
  return false;
};

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isAuth = checkAuth();
    setAuthenticated(isAuth);
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-gray-500 mb-4">Please refresh and enter correct credentials</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Retry Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="workers" element={<Workers />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="messages" element={<Messages />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="webhook-tester" element={<WebhookTester />} />
        <Route path="events" element={<Events />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
