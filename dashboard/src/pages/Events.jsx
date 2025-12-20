import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWorkers } from '../context/WorkersContext';
import { Activity, Trash2, Filter, RefreshCw, Server } from 'lucide-react';

const Events = () => {
  const { events, clearEvents } = useSocket();
  const { workers } = useWorkers();
  const [dbEvents, setDbEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ sessionId: '', type: '' });
  const [sessions, setSessions] = useState([]);
  const [clearing, setClearing] = useState(false);

  const getWorker = () => workers.find(w => w.status === 'online') || workers[0];

  useEffect(() => {
    if (workers.length > 0) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [workers, filter]);

  const fetchData = async () => {
    const worker = getWorker();
    if (!worker) {
      setLoading(false);
      return;
    }
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      const params = new URLSearchParams(filter).toString();
      const [eventsRes, sessionsRes] = await Promise.all([
        fetch(`${worker.url}/api/dashboard/events?${params}`, { headers }),
        fetch(`${worker.url}/api/sessions`, { headers }),
      ]);
      const eventsData = await eventsRes.json();
      const sessionsData = await sessionsRes.json();
      setDbEvents(eventsData.data || []);
      setSessions(sessionsData.data || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearDbLogs = async () => {
    const worker = getWorker();
    if (!worker) return;

    if (!confirm('Are you sure you want to clear all event logs from database?')) {
      return;
    }

    setClearing(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;

      // Build URL with optional session filter
      let url = `${worker.url}/api/dashboard/events`;
      if (filter.sessionId) {
        url += `?sessionId=${encodeURIComponent(filter.sessionId)}`;
      }

      const response = await fetch(url, { 
        method: 'DELETE',
        headers 
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDbEvents([]);
        alert(`Successfully cleared ${result.data?.deleted || 0} event logs`);
      } else {
        alert('Failed to clear logs: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
      alert('Failed to clear logs: ' + error.message);
    } finally {
      setClearing(false);
    }
  };

  // WAHA compatible event types
  const eventTypes = [
    'session.status',
    'message',
    'message.any',
    'message.ack',
    'message.reaction',
    'message.revoked',
    'group.v2.join',
    'group.v2.leave',
    'group.v2.participants',
    'presence.update',
    'call.received',
  ];

  const getEventColor = (type) => {
    if (type?.includes('message')) return 'border-blue-500/30 bg-blue-500/5';
    if (type?.includes('session')) return 'border-green-500/30 bg-green-500/5';
    if (type?.includes('group')) return 'border-purple-500/30 bg-purple-500/5';
    if (type?.includes('call')) return 'border-yellow-500/30 bg-yellow-500/5';
    return 'border-gray-500/30 bg-gray-500/5';
  };

  // Combine live events with DB events
  const allEvents = [
    ...events.map((e) => ({ ...e, isLive: true })),
    ...dbEvents.filter((dbE) => !events.some((e) => e.id === dbE.id)),
  ].sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));

  // Show connect prompt if no workers
  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Server className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Workers Connected</h2>
        <p className="text-gray-500 mb-4">Connect a WhatsApp Gateway server to view events</p>
        <a href="/workers" className="btn btn-primary">Connect Server</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-gray-500 mt-1">Real-time event log</p>
        </div>
        <div className="flex gap-2">
          <button onClick={clearEvents} className="btn btn-outline flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Clear Live
          </button>
          <button 
            onClick={handleClearDbLogs} 
            className="btn btn-danger flex items-center gap-2"
            disabled={clearing}
          >
            <Trash2 className="w-4 h-4" />
            {clearing ? 'Clearing...' : 'Clear Logs'}
          </button>
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Session</label>
              <select
                value={filter.sessionId}
                onChange={(e) => setFilter((prev) => ({ ...prev, sessionId: e.target.value }))}
                className="input w-full"
              >
                <option value="">All sessions</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.name}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Event Type</label>
              <select
                value={filter.type}
                onChange={(e) => setFilter((prev) => ({ ...prev, type: e.target.value }))}
                className="input w-full"
              >
                <option value="">All types</option>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : allEvents.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-16">
              <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Events</h3>
              <p className="text-gray-500">Events will appear here in real-time</p>
            </div>
          </div>
        ) : (
          allEvents.slice(0, 100).map((event, index) => (
            <div
              key={event.id || index}
              className={`card border ${getEventColor(event.event || event.type)}`}
            >
              <div className="card-body py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium text-primary-400">
                        {event.event || event.type}
                      </span>
                      {event.isLive && (
                        <span className="badge badge-success text-xs">LIVE</span>
                      )}
                      <span className="text-sm text-gray-500">
                        {typeof event.session === 'string' ? event.session : event.session?.name}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-500 mt-2 overflow-x-auto max-w-2xl">
                      {JSON.stringify(event.data, null, 2).substring(0, 500)}
                      {JSON.stringify(event.data).length > 500 && '...'}
                    </pre>
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {new Date(event.timestamp || event.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Events;
