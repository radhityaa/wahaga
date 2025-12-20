import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkers } from '../context/WorkersContext';
import toast from 'react-hot-toast';
import { Key, Copy, Eye, EyeOff, Settings, Server, RefreshCw } from 'lucide-react';

const SettingsPage = () => {
  const { apiKey, logout } = useAuth();
  const { workers } = useWorkers();
  const [showKey, setShowKey] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);

  const getWorker = () => workers.find(w => w.status === 'online') || workers[0];

  useEffect(() => {
    if (workers.length > 0) {
      fetchSystemInfo();
    }
  }, [workers]);

  const fetchSystemInfo = async () => {
    const worker = getWorker();
    if (!worker) return;
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      const res = await fetch(`${worker.url}/api/dashboard/system`, { headers });
      const data = await res.json();
      setSystemInfo(data.data);
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    }
  };

  const copyKey = () => {
    const worker = getWorker();
    const keyToCopy = worker?.apiKey || apiKey || '';
    navigator.clipboard.writeText(keyToCopy);
    toast.success('API Key copied to clipboard');
  };

  // Show connect prompt if no workers
  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Server className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Workers Connected</h2>
        <p className="text-gray-500 mb-4">Connect a WhatsApp Gateway server to view settings</p>
        <a href="/workers" className="btn btn-primary">Connect Server</a>
      </div>
    );
  }

  const activeWorker = getWorker();
  const displayApiKey = activeWorker?.apiKey || apiKey || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">API key and system information</p>
      </div>

      {/* Current API Key */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Key
          </h3>
        </div>
        <div className="card-body space-y-4">
          <p className="text-gray-400 text-sm">
            This is your API key for accessing the WhatsApp Gateway API. 
            Include it in the <code className="bg-dark-800 px-1 rounded">X-API-Key</code> header.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={displayApiKey}
                readOnly
                className="input w-full font-mono text-sm pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button onClick={copyKey} className="btn btn-outline">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          
          {/* Usage Example */}
          <div className="bg-dark-800/50 rounded-xl p-4">
            <p className="text-sm font-medium mb-2">Example Usage:</p>
            <pre className="text-xs text-gray-400 overflow-x-auto">
{`curl -X GET ${activeWorker?.url || 'http://localhost:3000'}/api/sessions \\
  -H "X-API-Key: ${displayApiKey || 'your-api-key'}"`}
            </pre>
          </div>
          
          <button onClick={logout} className="btn btn-danger">
            Disconnect from Dashboard
          </button>
        </div>
      </div>

      {/* System Information */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Server className="w-5 h-5" />
            System Information
          </h3>
          <button onClick={fetchSystemInfo} className="btn btn-outline btn-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="card-body">
          {systemInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Platform</p>
                  <p className="font-medium">{systemInfo.system?.platform} ({systemInfo.system?.arch})</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Node.js Version</p>
                  <p className="font-medium">{systemInfo.system?.nodeVersion}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Hostname</p>
                  <p className="font-medium">{systemInfo.system?.hostname}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Uptime</p>
                  <p className="font-medium">{systemInfo.uptime?.formatted}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CPU Cores</p>
                  <p className="font-medium">{systemInfo.cpu?.cores} cores</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cache Type</p>
                  <span className="badge badge-info">{systemInfo.cache?.type || 'node-cache'}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading system info...</p>
          )}
        </div>
      </div>

      {/* API Documentation Link */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">API Documentation</h3>
              <p className="text-sm text-gray-500">View full API documentation with Swagger</p>
            </div>
            <a 
              href="/api-docs" 
              target="_blank" 
              className="btn btn-primary"
            >
              Open API Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
