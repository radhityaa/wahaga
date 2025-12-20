import { useState } from 'react';
import { useWorkers } from '../context/WorkersContext';
import toast from 'react-hot-toast';
import {
  Plus,
  Server,
  Trash2,
  Edit2,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Link2,
} from 'lucide-react';

const Workers = () => {
  const {
    workers,
    activeWorker,
    addWorker,
    updateWorker,
    removeWorker,
    setActiveWorker,
    refreshWorkerStatuses,
    checkWorkerStatus,
  } = useWorkers();

  const [showModal, setShowModal] = useState(false);
  const [editWorker, setEditWorker] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '', apiKey: '' });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const openAddModal = () => {
    setEditWorker(null);
    setFormData({ name: '', url: '', apiKey: '' });
    setShowModal(true);
  };

  const openEditModal = (worker) => {
    setEditWorker(worker);
    setFormData({ name: worker.name, url: worker.url, apiKey: worker.apiKey || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('Name and URL are required');
      return;
    }

    setSaving(true);
    try {
      if (editWorker) {
        await updateWorker(editWorker.id, formData);
        toast.success('Worker updated');
      } else {
        const newWorker = await addWorker(formData);
        if (newWorker.status === 'online') {
          toast.success('Worker connected successfully');
        } else {
          toast.error(`Worker added but ${newWorker.statusMessage}`);
        }
      }
      setShowModal(false);
    } catch (err) {
      toast.error('Failed to save worker');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (worker) => {
    if (confirm(`Remove worker "${worker.name}"?`)) {
      removeWorker(worker.id);
      toast.success('Worker removed');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshWorkerStatuses();
    setRefreshing(false);
    toast.success('Worker statuses refreshed');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'online':
        return 'badge-success';
      case 'error':
        return 'badge-danger';
      case 'offline':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workers</h1>
          <p className="text-gray-500 mt-1">Connect multiple WhatsApp Gateway servers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="btn btn-secondary flex items-center gap-2"
            disabled={refreshing}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={openAddModal} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Connect Server
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Link2 className="w-5 h-5 text-blue-400 mt-0.5" />
        <div>
          <p className="text-blue-300 font-medium">Workers Data Stored Locally</p>
          <p className="text-blue-300/70 text-sm mt-1">
            Workers configuration is saved in your browser's local storage. It's safe to store API URLs and keys here.
          </p>
        </div>
      </div>

      {/* Workers Grid */}
      {workers.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <Server className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Workers Connected</h3>
            <p className="text-gray-500 mb-6">Connect your first WhatsApp Gateway server to get started</p>
            <button onClick={openAddModal} className="btn btn-primary">
              Connect Server
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className={`card hover:border-primary-500/30 transition-all cursor-pointer ${
                activeWorker?.id === worker.id ? 'border-primary-500 ring-2 ring-primary-500/20' : ''
              }`}
              onClick={() => setActiveWorker(worker)}
            >
              <div className="card-body">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(worker.status)}
                    <div>
                      <h3 className="font-semibold">{worker.name}</h3>
                      <span className={`badge ${getStatusBadge(worker.status)}`}>
                        {worker.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                  {activeWorker?.id === worker.id && (
                    <span className="badge badge-primary">Active</span>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-400 truncate" title={worker.url}>
                    <span className="text-gray-600">URL:</span> {worker.url}
                  </p>
                  {worker.statusMessage && worker.status !== 'online' && (
                    <p className="text-sm text-red-400">
                      ⚠️ {worker.statusMessage}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">
                    Added: {new Date(worker.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEditModal(worker)}
                    className="btn btn-outline btn-sm flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(worker)}
                    className="btn btn-danger btn-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card w-full max-w-md mx-4">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold">
                {editWorker ? 'Edit Worker' : 'Connect Server'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-dark-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., SERVER1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">API URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., https://api.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">API Key (optional)</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="input w-full"
                  placeholder="Leave empty if no auth required"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editWorker ? 'Update' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workers;
