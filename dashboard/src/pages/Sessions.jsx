import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWorkers } from '../context/WorkersContext';
import toast from 'react-hot-toast';
import Select from 'react-select';
import {
  Plus,
  Trash2,
  RefreshCw,
  LogOut,
  QrCode,
  Smartphone,
  X,
  Loader2,
  Copy,
  Server,
  ChevronDown,
  ChevronUp,
  Minus,
  Play,
  Square,
} from 'lucide-react';

// React-Select custom styles for dark theme
const selectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    '&:hover': { borderColor: '#10b981' },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#334155' : '#1e293b',
    color: '#fff',
    '&:hover': { backgroundColor: '#334155' },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#10b981',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#fff',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#fff',
    '&:hover': { backgroundColor: '#059669', color: '#fff' },
  }),
  input: (base) => ({ ...base, color: '#fff' }),
  placeholder: (base) => ({ ...base, color: '#6b7280' }),
};

// Default webhook template
const createEmptyWebhook = () => ({
  id: Date.now(),
  expanded: true,
  url: '',
  events: [],
  retries: 15,
  delay: 2,
  retryPolicy: 'exponential',
  hmacKey: '',
  headers: [],
});

const Sessions = () => {
  const { sessions, setSessions } = useSocket();
  const { workers } = useWorkers();
  const [dbSessions, setDbSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionWorker, setNewSessionWorker] = useState('');
  
  // Multiple webhooks support
  const [webhooks, setWebhooks] = useState([createEmptyWebhook()]);
  const [creating, setCreating] = useState(false);
  
  const availableEvents = [
    // Session
    { value: 'session.status', label: 'session.status' },
    // Messages
    { value: 'message', label: 'message' },
    { value: 'message.any', label: 'message.any' },
    { value: 'message.reaction', label: 'message.reaction' },
    { value: 'message.ack', label: 'message.ack' },
    { value: 'message.waiting', label: 'message.waiting' },
    { value: 'message.edited', label: 'message.edited' },
    { value: 'message.revoked', label: 'message.revoked' },
    // Chat
    { value: 'chat.archive', label: 'chat.archive' },
    // Groups
    { value: 'group.v2.join', label: 'group.v2.join' },
    { value: 'group.v2.leave', label: 'group.v2.leave' },
    { value: 'group.v2.participants', label: 'group.v2.participants' },
    { value: 'group.v2.update', label: 'group.v2.update' },
    // Labels
    { value: 'label.upsert', label: 'label.upsert' },
    { value: 'label.deleted', label: 'label.deleted' },
    { value: 'label.chat.added', label: 'label.chat.added' },
    { value: 'label.chat.deleted', label: 'label.chat.deleted' },
    // Presence
    { value: 'presence.update', label: 'presence.update' },
    // Polls
    { value: 'poll.vote', label: 'poll.vote' },
    { value: 'poll.vote.failed', label: 'poll.vote.failed' },
    // Calls
    { value: 'call.received', label: 'call.received' },
    { value: 'call.accepted', label: 'call.accepted' },
    { value: 'call.rejected', label: 'call.rejected' },
    // Engine
    { value: 'engine.event', label: 'engine.event' },
  ];
  
  const updateWebhook = (id, field, value) => {
    setWebhooks(webhooks.map(w => w.id === id ? { ...w, [field]: value } : w));
  };
  
  const addWebhook = () => {
    setWebhooks([...webhooks, createEmptyWebhook()]);
  };
  
  const removeWebhook = (id) => {
    if (webhooks.length > 1) {
      setWebhooks(webhooks.filter(w => w.id !== id));
    } else {
      // Reset the only webhook instead of removing
      setWebhooks([createEmptyWebhook()]);
    }
  };
  
  const addHeader = (webhookId) => {
    setWebhooks(webhooks.map(w => {
      if (w.id === webhookId) {
        return { ...w, headers: [...w.headers, { key: '', value: '' }] };
      }
      return w;
    }));
  };
  
  const updateHeader = (webhookId, headerIdx, field, value) => {
    setWebhooks(webhooks.map(w => {
      if (w.id === webhookId) {
        const newHeaders = [...w.headers];
        newHeaders[headerIdx] = { ...newHeaders[headerIdx], [field]: value };
        return { ...w, headers: newHeaders };
      }
      return w;
    }));
  };
  
  const removeHeader = (webhookId, headerIdx) => {
    setWebhooks(webhooks.map(w => {
      if (w.id === webhookId) {
        return { ...w, headers: w.headers.filter((_, i) => i !== headerIdx) };
      }
      return w;
    }));
  };

  useEffect(() => {
    if (workers.length > 0) {
      fetchSessions();
    } else {
      setLoading(false);
    }
  }, [workers]);

  const fetchSessions = async () => {
    if (workers.length === 0) return;
    
    try {
      let allSessions = [];
      for (const worker of workers) {
        try {
          const headers = worker.apiKey ? { 'x-api-key': worker.apiKey } : {};
          const res = await fetch(`${worker.url}/api/sessions`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              allSessions = allSessions.concat(
                data.data.map(s => ({ ...s, worker, workerName: worker.name }))
              );
            }
          }
        } catch (e) {
          console.error(`Failed to fetch from ${worker.name}:`, e);
        }
      }
      setDbSessions(allSessions);
    } catch (error) {
      toast.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!newSessionName.trim()) {
      toast.error('Session name is required');
      return;
    }
    
    if (!newSessionWorker && workers.length > 0) {
      setNewSessionWorker(workers[0].id);
    }
    
    const worker = workers.find(w => w.id === newSessionWorker) || workers[0];
    if (!worker) {
      toast.error('No worker selected');
      return;
    }

    setCreating(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      // Create session
      const res = await fetch(`${worker.url}/api/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newSessionName.trim() }),
      });
      
      if (res.ok) {
        const sessionData = await res.json();
        
        // Create all webhooks configured
        for (const webhook of webhooks) {
          if (webhook.url.trim() && webhook.events.length > 0) {
            try {
              // Convert headers array to object
              const customHeaders = {};
              webhook.headers.forEach(h => {
                if (h.key.trim()) customHeaders[h.key.trim()] = h.value;
              });
              
              await fetch(`${worker.url}/api/webhooks`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  sessionId: sessionData.data.id,
                  url: webhook.url.trim(),
                  events: webhook.events.map(e => e.value),
                  isActive: true,
                  retries: webhook.retries,
                  retryDelay: webhook.delay * 1000,
                  retryPolicy: webhook.retryPolicy,
                  hmacSecret: webhook.hmacKey || undefined,
                  customHeaders: Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
                }),
              });
            } catch (webhookErr) {
              console.error('Failed to create webhook:', webhookErr);
            }
          }
        }
        
        toast.success('Session created! Scan QR code to connect.');
        setShowCreateModal(false);
        setNewSessionName('');
        setWebhooks([createEmptyWebhook()]);
        fetchSessions();
        setTimeout(() => {
          setSelectedSession({ name: newSessionName.trim() });
          setSelectedWorker(worker);
          setShowQrModal(true);
        }, 1000);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to create session');
      }
    } catch (error) {
      toast.error('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const deleteSession = async (session) => {
    if (!confirm(`Delete session "${session.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const headers = {};
      if (session.worker.apiKey) headers['x-api-key'] = session.worker.apiKey;
      
      await fetch(`${session.worker.url}/api/sessions/${session.name}`, {
        method: 'DELETE',
        headers,
      });
      toast.success('Session deleted');
      fetchSessions();
    } catch (error) {
      toast.error('Failed to delete session');
    }
  };

  const startSession = async (session) => {
    try {
      const headers = {};
      if (session.worker.apiKey) headers['x-api-key'] = session.worker.apiKey;
      
      await fetch(`${session.worker.url}/api/sessions/${session.name}/restart`, {
        method: 'POST',
        headers,
      });
      toast.success('Session starting...');
      fetchSessions();
    } catch (error) {
      toast.error('Failed to start session');
    }
  };

  const stopSession = async (session) => {
    try {
      const headers = {};
      if (session.worker.apiKey) headers['x-api-key'] = session.worker.apiKey;
      
      await fetch(`${session.worker.url}/api/sessions/${session.name}/stop`, {
        method: 'POST',
        headers,
      });
      toast.success('Session stopped');
      fetchSessions();
    } catch (error) {
      toast.error('Failed to stop session');
    }
  };

  const restartSession = async (session) => {
    try {
      const headers = {};
      if (session.worker.apiKey) headers['x-api-key'] = session.worker.apiKey;
      
      await fetch(`${session.worker.url}/api/sessions/${session.name}/restart`, {
        method: 'POST',
        headers,
      });
      toast.success('Session restarting...');
    } catch (error) {
      toast.error('Failed to restart session');
    }
  };

  const logoutSession = async (session) => {
    if (!confirm(`Logout session "${session.name}"? You will need to scan QR code again to reconnect.`)) {
      return;
    }
    try {
      const headers = {};
      if (session.worker.apiKey) headers['x-api-key'] = session.worker.apiKey;
      
      await fetch(`${session.worker.url}/api/sessions/${session.name}/logout`, {
        method: 'POST',
        headers,
      });
      toast.success('Session logged out');
      fetchSessions();
    } catch (error) {
      toast.error('Failed to logout session');
    }
  };

  const showQr = (session) => {
    setSelectedSession(session);
    setSelectedWorker(session.worker);
    setShowQrModal(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      connected: 'badge-success',
      disconnected: 'badge-danger',
      connecting: 'badge-warning',
      reconnecting: 'badge-warning',
      stopped: 'badge-danger',
      created: 'badge-info',
      qr: 'badge-info',
    };
    return badges[status] || 'badge-info';
  };

  // Merge live sessions with DB sessions
  const mergedSessions = [...dbSessions.map((dbSession) => {
    const liveSession = sessions.find((s) => s.name === dbSession.name);
    return {
      ...dbSession,
      liveStatus: liveSession?.status || dbSession.liveStatus || dbSession.status,
      qrBase64: liveSession?.qrBase64,
    };
  })];

  // Also append any live session from WebSocket that isn't in DB yet
  sessions.forEach((liveSession) => {
    if (!mergedSessions.find((s) => s.name === liveSession.name)) {
      mergedSessions.push({
        id: liveSession.name,
        name: liveSession.name,
        phone: liveSession.phone,
        pushName: liveSession.pushName,
        liveStatus: liveSession.status,
        qrBase64: liveSession.qrBase64,
        createdAt: new Date().toISOString(),
        worker: workers[0] || {},
      });
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-gray-500 mt-1">Manage your WhatsApp sessions</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Session
        </button>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : mergedSessions.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <Smartphone className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Sessions Yet</h3>
            <p className="text-gray-500 mb-6">Create your first WhatsApp session to get started</p>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              Create Session
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mergedSessions.map((session) => (
            <div key={session.id} className="card hover:border-primary-500/30 transition-all">
              <div className="card-body">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`status-dot ${session.liveStatus}`} />
                    <div>
                      <h3 className="font-semibold">{session.name}</h3>
                      <span className={`badge ${getStatusBadge(session.liveStatus)}`}>
                        {session.liveStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4">
                  {session.phone && (
                    <p className="text-sm text-gray-400">
                      <span className="text-gray-600">Phone:</span> {session.phone}
                    </p>
                  )}
                  {session.pushName && (
                    <p className="text-sm text-gray-400">
                      <span className="text-gray-600">Name:</span> {session.pushName}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">
                    Created: {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {/* Start button - shown when disconnected/stopped/created */}
                  {(['disconnected', 'stopped', 'created'].includes(session.liveStatus)) && (
                    <button
                      onClick={() => startSession(session)}
                      className="btn btn-outline btn-sm flex items-center gap-1"
                      title="Start session"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  )}
                  {/* Stop button - shown when connecting */}
                  {session.liveStatus === 'connecting' && (
                    <button
                      onClick={() => stopSession(session)}
                      className="btn btn-outline btn-sm flex items-center gap-1"
                      title="Stop session"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  )}
                  {/* Restart button - shown when connected or reconnecting */}
                  {(['connected', 'reconnecting'].includes(session.liveStatus)) && (
                    <button
                      onClick={() => restartSession(session)}
                      className="btn btn-outline btn-sm flex items-center gap-1"
                      title="Restart session"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Restart
                    </button>
                  )}
                  {/* Logout button - shown when connected */}
                  {session.liveStatus === 'connected' && (
                    <button
                      onClick={() => logoutSession(session)}
                      className="btn btn-outline btn-sm flex items-center gap-1"
                      title="Logout from WhatsApp"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  )}
                  {/* QR Code button - shown when status is qr */}
                  {session.liveStatus === 'qr' && (
                    <button
                      onClick={() => showQr(session)}
                      className="btn btn-outline btn-sm flex items-center gap-1"
                      title="Show QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                      QR Code
                    </button>
                  )}
                  <button
                    onClick={() => deleteSession(session)}
                    className="btn btn-danger btn-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold">Create New Session</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-dark-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="card-body space-y-4">
              {/* Session Name */}
              <div>
                <label className="block text-sm font-medium mb-2">Session Name</label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="input w-full"
                  placeholder="my-session"
                  pattern="[a-zA-Z0-9_-]+"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Only letters, numbers, underscores, and hyphens allowed
                </p>
              </div>
              
              {/* Worker Selection */}
              {workers.length > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Server</label>
                  <select
                    value={newSessionWorker}
                    onChange={(e) => setNewSessionWorker(e.target.value)}
                    className="input w-full"
                  >
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Webhooks Configuration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Webhooks (Optional)</label>
                  <button type="button" onClick={addWebhook} className="btn btn-primary btn-sm flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Webhook
                  </button>
                </div>
                
                {webhooks.map((webhook, whIdx) => (
                  <div key={webhook.id} className="border border-dark-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateWebhook(webhook.id, 'expanded', !webhook.expanded)}
                      className="w-full flex items-center justify-between p-3 bg-dark-800/50 hover:bg-dark-700/50 transition-colors"
                    >
                      <span className="font-medium flex items-center gap-2">
                        {webhook.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Webhook {whIdx + 1}
                        {webhook.url && <span className="text-xs text-gray-500 ml-2 truncate max-w-[150px]">{webhook.url}</span>}
                      </span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeWebhook(webhook.id); }}
                        className="p-1 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                    </button>
                    
                    {webhook.expanded && (
                      <div className="p-4 space-y-4 border-t border-dark-700">
                        {/* URL */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">URL</label>
                          <input
                            type="url"
                            value={webhook.url}
                            onChange={(e) => updateWebhook(webhook.id, 'url', e.target.value)}
                            className="input w-full"
                            placeholder="https://httpbin.org/post"
                          />
                        </div>
                        
                        {/* Events - React Select */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Events</label>
                          <Select
                            isMulti
                            options={availableEvents}
                            value={webhook.events}
                            onChange={(val) => updateWebhook(webhook.id, 'events', val)}
                            styles={selectStyles}
                            placeholder="Select events..."
                            className="text-sm"
                          />
                          {webhook.events.length > 0 && (
                            <ul className="mt-2 text-sm text-gray-400 list-disc list-inside">
                              {webhook.events.map(e => <li key={e.value}>{e.label}</li>)}
                            </ul>
                          )}
                        </div>
                        
                        {/* Retries Config */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Attempts</label>
                            <div className="flex items-center">
                              <button type="button" onClick={() => updateWebhook(webhook.id, 'retries', Math.max(0, webhook.retries - 1))}
                                className="btn btn-outline p-2"><Minus className="w-4 h-4" /></button>
                              <input type="number" value={webhook.retries} onChange={(e) => updateWebhook(webhook.id, 'retries', parseInt(e.target.value) || 0)}
                                className="input w-16 text-center mx-1" />
                              <button type="button" onClick={() => updateWebhook(webhook.id, 'retries', webhook.retries + 1)}
                                className="btn btn-outline p-2"><Plus className="w-4 h-4" /></button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Delay (sec)</label>
                            <div className="flex items-center">
                              <button type="button" onClick={() => updateWebhook(webhook.id, 'delay', Math.max(0, webhook.delay - 1))}
                                className="btn btn-outline p-2"><Minus className="w-4 h-4" /></button>
                              <input type="number" value={webhook.delay} onChange={(e) => updateWebhook(webhook.id, 'delay', parseInt(e.target.value) || 0)}
                                className="input w-16 text-center mx-1" />
                              <button type="button" onClick={() => updateWebhook(webhook.id, 'delay', webhook.delay + 1)}
                                className="btn btn-outline p-2"><Plus className="w-4 h-4" /></button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Retry Policy</label>
                            <select value={webhook.retryPolicy} onChange={(e) => updateWebhook(webhook.id, 'retryPolicy', e.target.value)}
                              className="input w-full">
                              <option value="exponential">Exponential</option>
                              <option value="linear">Linear</option>
                              <option value="constant">Constant</option>
                            </select>
                          </div>
                        </div>
                        
                        {/* HMAC Key */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">HMAC Key (optional)</label>
                          <input
                            type="text"
                            value={webhook.hmacKey}
                            onChange={(e) => updateWebhook(webhook.id, 'hmacKey', e.target.value)}
                            className="input w-full"
                            placeholder="Enter HMAC secret key"
                          />
                        </div>
                        
                        {/* Custom Headers */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-400">Custom Headers (optional)</label>
                            <button type="button" onClick={() => addHeader(webhook.id)}
                              className="btn btn-primary btn-sm flex items-center gap-1">
                              <Plus className="w-3 h-3" /> Header
                            </button>
                          </div>
                          {webhook.headers.length > 0 && (
                            <div className="space-y-2">
                              {webhook.headers.map((header, hIdx) => (
                                <div key={hIdx} className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={header.key}
                                    onChange={(e) => updateHeader(webhook.id, hIdx, 'key', e.target.value)}
                                    className="input flex-1"
                                    placeholder="Header name"
                                  />
                                  <input
                                    type="text"
                                    value={header.value}
                                    onChange={(e) => updateHeader(webhook.id, hIdx, 'value', e.target.value)}
                                    className="input flex-1"
                                    placeholder="Value"
                                  />
                                  <button type="button" onClick={() => removeHeader(webhook.id, hIdx)}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-dark-700 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={createSession}
                  disabled={creating}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Plus className="w-4 h-4" /> Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedSession && (
        <QrModal
          session={selectedSession}
          worker={selectedWorker}
          sessions={sessions}
          onClose={() => {
            setShowQrModal(false);
            setSelectedSession(null);
            setSelectedWorker(null);
            // Refresh session list when modal is closed
            fetchSessions();
          }}
          onConnected={() => {
            setShowQrModal(false);
            setSelectedSession(null);
            setSelectedWorker(null);
            // Force a refresh to get the latest phone/pushName from DB
            fetchSessions();
          }}
        />
      )}
    </div>
  );
};

// QR Modal Component
const QrModal = ({ session, worker, sessions, onClose, onConnected }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (worker) {
      fetchQr();
      const interval = setInterval(fetchQr, 20000);
      return () => clearInterval(interval);
    }
  }, [session.name, worker]);

  // Check real-time updates via WebSocket
  useEffect(() => {
    const liveSession = sessions.find((s) => s.name === session.name);
    if (liveSession?.qrBase64) {
      setQrData({ qrBase64: liveSession.qrBase64 });
      setLoading(false);
    }
    if (liveSession?.status === 'connected') {
      toast.success(`✅ Session "${session.name}" connected!`);
      onConnected();
    }
  }, [sessions, session.name]);

  const fetchQr = async () => {
    if (!worker) return;
    try {
      const headers = worker.apiKey ? { 'x-api-key': worker.apiKey } : {};
      const res = await fetch(`${worker.url}/api/sessions/${session.name}/qr`, { headers });
      
      if (res.ok) {
        const data = await res.json();
        if (data.data.status === 'connected') {
          toast.success('Session already connected!');
          onClose();
          return;
        }
        setQrData(data.data);
        setError(null);
      } else if (res.status === 404) {
        setError('Waiting for QR code...');
      } else {
        setError('Failed to get QR code');
      }
    } catch (err) {
      setError('Failed to get QR code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="card w-full max-w-md mx-4">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Scan QR Code</h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="card-body text-center">
          <p className="text-gray-400 mb-4">
            Scan this QR code with WhatsApp on your phone
          </p>
          <p className="text-sm font-medium mb-4">{session.name}</p>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            </div>
          ) : qrData?.qrBase64 ? (
            <div className="qr-container mx-auto">
              <img src={qrData.qrBase64} alt="QR Code" className="w-48 h-48" />
            </div>
          ) : (
            <div className="py-16 text-gray-500">
              {error || 'Generating QR code...'}
            </div>
          )}

          <p className="text-xs text-gray-600 mt-4">
            QR code will refresh automatically
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sessions;
