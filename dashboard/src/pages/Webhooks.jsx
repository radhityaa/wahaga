import { useState, useEffect } from 'react';
import { useWorkers } from '../context/WorkersContext';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, X, Loader2, Webhook, Check, XCircle, TestTube, Server } from 'lucide-react';

const Webhooks = () => {
  const { workers } = useWorkers();
  const [webhooks, setWebhooks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);

  const getWorker = () => workers.find(w => w.status === 'online') || workers[0];

  useEffect(() => {
    if (workers.length > 0) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [workers]);

  const fetchData = async () => {
    const worker = getWorker();
    if (!worker) {
      setLoading(false);
      return;
    }
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      const [webhooksRes, sessionsRes] = await Promise.all([
        fetch(`${worker.url}/api/webhooks`, { headers }),
        fetch(`${worker.url}/api/sessions`, { headers }),
      ]);
      const webhooksData = await webhooksRes.json();
      const sessionsData = await sessionsRes.json();
      setWebhooks(webhooksData.data || []);
      setSessions(sessionsData.data || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    
    const worker = getWorker();
    if (!worker) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      await fetch(`${worker.url}/api/webhooks/${id}`, { method: 'DELETE', headers });
      toast.success('Webhook deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  const testWebhook = async (webhook) => {
    const worker = getWorker();
    if (!worker) return;
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      const res = await fetch(`${worker.url}/api/webhooks/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: webhook.url, headers: webhook.headers }),
      });
      const response = await res.json();
      if (response.data?.success) {
        toast.success(`Test successful! Status: ${response.data.status}`);
      } else {
        toast.error(`Test failed: ${response.data?.error}`);
      }
    } catch (error) {
      toast.error('Test failed');
    }
  };

  const openEdit = (webhook) => {
    setEditingWebhook(webhook);
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingWebhook(null);
    setShowModal(true);
  };

  // Show connect prompt if no workers
  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Server className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Workers Connected</h2>
        <p className="text-gray-500 mb-4">Connect a WhatsApp Gateway server to manage webhooks</p>
        <a href="/workers" className="btn btn-primary">Connect Server</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-gray-500 mt-1">Configure event notifications</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/webhook-tester" className="btn btn-outline flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Webhook Tester
          </a>
          <button onClick={openCreate} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Webhook
          </button>
        </div>
      </div>

      {/* Webhooks List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-16">
              <Webhook className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Webhooks Configured</h3>
              <p className="text-gray-500 mb-6">Add a webhook to receive event notifications</p>
              <button onClick={openCreate} className="btn btn-primary">
                Add Webhook
              </button>
            </div>
          </div>
        ) : (
          webhooks.map((webhook) => (
            <div key={webhook.id} className="card">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`badge ${webhook.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {webhook.session && (
                        <span className="badge badge-info">{webhook.session.name}</span>
                      )}
                      {!webhook.sessionId && <span className="badge badge-warning">Global</span>}
                    </div>
                    <p className="font-mono text-sm text-gray-400 break-all">{webhook.url}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(webhook.events || ['*']).map((event, i) => (
                        <span key={i} className="px-2 py-1 bg-dark-800 rounded text-xs text-gray-400">
                          {event}
                        </span>
                      ))}
                    </div>
                    {webhook.lastTriggeredAt && (
                      <p className="text-xs text-gray-600 mt-2">
                        Last triggered: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                        {webhook.lastStatus && ` (${webhook.lastStatus})`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => testWebhook(webhook)}
                      className="btn btn-outline btn-sm"
                      title="Test webhook"
                    >
                      <TestTube className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(webhook)}
                      className="btn btn-outline btn-sm"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="btn btn-danger btn-sm"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <WebhookModal
          webhook={editingWebhook}
          sessions={sessions}
          getWorker={getWorker}
          onClose={() => {
            setShowModal(false);
            setEditingWebhook(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditingWebhook(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

// Webhook Modal
const WebhookModal = ({ webhook, sessions, getWorker, onClose, onSaved }) => {
  const [formData, setFormData] = useState({
    url: webhook?.url || '',
    sessionId: webhook?.sessionId || '',
    events: webhook?.events || ['*'],
    isActive: webhook?.isActive ?? true,
    retries: webhook?.retries || 3,
  });
  const [saving, setSaving] = useState(false);

  // WAHA compatible events
  const eventOptions = [
    '*',
    'session.status',
    'message',
    'message.any',
    'message.reaction',
    'message.ack',
    'message.waiting',
    'message.edited',
    'message.revoked',
    'chat.archive',
    'group.v2.join',
    'group.v2.leave',
    'group.v2.participants',
    'group.v2.update',
    'presence.update',
    'poll.vote',
    'poll.vote.failed',
    'call.received',
    'call.accepted',
    'call.rejected',
    'label.upsert',
    'label.deleted',
    'label.chat.added',
    'label.chat.deleted',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const worker = getWorker();
    if (!worker) {
      setSaving(false);
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      const data = {
        ...formData,
        sessionId: formData.sessionId || null,
      };

      if (webhook) {
        await fetch(`${worker.url}/api/webhooks/${webhook.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(data),
        });
        toast.success('Webhook updated');
      } else {
        await fetch(`${worker.url}/api/webhooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });
        toast.success('Webhook created');
      }
      onSaved();
    } catch (error) {
      toast.error('Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (event) => {
    if (event === '*') {
      setFormData((prev) => ({ ...prev, events: ['*'] }));
    } else {
      setFormData((prev) => {
        const events = prev.events.filter((e) => e !== '*');
        if (events.includes(event)) {
          return { ...prev, events: events.filter((e) => e !== event) };
        }
        return { ...prev, events: [...events, event] };
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="card-header flex items-center justify-between sticky top-0 bg-dark-900">
          <h3 className="font-semibold">{webhook ? 'Edit Webhook' : 'Add Webhook'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="card-body space-y-4">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium mb-2">Webhook URL *</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              className="input w-full"
              placeholder="https://example.com/webhook"
              required
            />
          </div>

          {/* Session */}
          <div>
            <label className="block text-sm font-medium mb-2">Session (optional)</label>
            <select
              value={formData.sessionId}
              onChange={(e) => setFormData((prev) => ({ ...prev, sessionId: e.target.value }))}
              className="input w-full"
            >
              <option value="">All sessions (global)</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>

          {/* Events */}
          <div>
            <label className="block text-sm font-medium mb-2">Events</label>
            <div className="flex flex-wrap gap-2">
              {eventOptions.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    formData.events.includes(event)
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'bg-dark-800 text-gray-400 border border-dark-700 hover:border-dark-600'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          {/* Active */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 rounded bg-dark-800 border-dark-600"
            />
            <label htmlFor="isActive" className="text-sm">Active</label>
          </div>

          {/* Retries */}
          <div>
            <label className="block text-sm font-medium mb-2">Retry Count</label>
            <input
              type="number"
              value={formData.retries}
              onChange={(e) => setFormData((prev) => ({ ...prev, retries: parseInt(e.target.value) }))}
              className="input w-full"
              min="0"
              max="10"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {webhook ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Webhooks;
