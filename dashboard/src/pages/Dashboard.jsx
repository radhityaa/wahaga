import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWorkers } from '../context/WorkersContext';
import {
  Smartphone,
  MessageSquare,
  Webhook,
  Clock,
  Activity,
  TrendingUp,
  Server,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard = () => {
  const { sessions } = useSocket();
  const { workers } = useWorkers();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workers.length > 0) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [workers]);

  const fetchData = async () => {
    if (workers.length === 0) return;
    
    try {
      let totalSessions = 0;
      let connectedSessions = 0;
      
      for (const worker of workers) {
        try {
          const headers = worker.apiKey ? { 'x-api-key': worker.apiKey } : {};
          const res = await fetch(`${worker.url}/api/sessions`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              totalSessions += data.data.length;
              connectedSessions += data.data.filter(s => s.status === 'connected').length;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch from ${worker.name}:`, e);
        }
      }
      
      setStats({ sessions: { total: totalSessions, connected: connectedSessions } });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Show welcome if no workers connected
  if (workers.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome to Dashboard</h1>
          <p className="text-gray-500 mt-1">Connect a WhatsApp Gateway server to get started</p>
        </div>
        <div className="card">
          <div className="card-body text-center py-16">
            <Server className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Workers Connected</h3>
            <p className="text-gray-500 mb-6">Go to Workers page to connect your first WhatsApp Gateway server</p>
            <a href="/workers" className="btn btn-primary">
              Connect Server
            </a>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Sessions',
      value: stats?.sessions?.total || 0,
      subValue: `${stats?.sessions?.connected || 0} connected`,
      icon: Smartphone,
      color: 'from-primary-400 to-primary-600',
    },
    {
      label: 'Workers',
      value: workers.length,
      subValue: `${workers.filter(w => w.status === 'online').length} online`,
      icon: Server,
      color: 'from-blue-400 to-blue-600',
    },
    {
      label: 'Active Webhooks',
      value: 0,
      subValue: 'Configure in Webhooks',
      icon: Webhook,
      color: 'from-purple-400 to-purple-600',
    },
    {
      label: 'Status',
      value: 'Running',
      subValue: 'System operational',
      icon: Clock,
      color: 'from-amber-400 to-amber-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Monitor your WhatsApp Gateway in real-time</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-500 text-sm">{card.label}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.subValue}</p>
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Sessions */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Live Sessions</h3>
          <span className="badge badge-success">{sessions.length} active</span>
        </div>
        <div className="card-body">
          {sessions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No active sessions</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <div
                  key={session.name}
                  className="bg-dark-800/50 rounded-xl p-4 border border-dark-700"
                >
                  <div className="flex items-center gap-3">
                    <div className={`status-dot ${session.status}`} />
                    <div>
                      <p className="font-medium">{session.name}</p>
                      <p className="text-sm text-gray-500">
                        {session.phone || 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {session.pushName && (
                    <p className="text-xs text-gray-500 mt-2">
                      {session.pushName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
