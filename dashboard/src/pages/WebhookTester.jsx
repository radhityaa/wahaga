import { useState } from 'react';
import { useWorkers } from '../context/WorkersContext';
import toast from 'react-hot-toast';
import { 
  Send, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Code, 
  Copy, 
  Check,
  Server,
  ChevronDown,
  ChevronRight,
  Zap
} from 'lucide-react';

const WebhookTester = () => {
  const { workers } = useWorkers();
  const [url, setUrl] = useState('');
  const [customHeaders, setCustomHeaders] = useState('');
  const [customPayload, setCustomPayload] = useState('');
  const [useCustomPayload, setUseCustomPayload] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [expandRequest, setExpandRequest] = useState(false);
  const [expandResponse, setExpandResponse] = useState(true);
  const [copied, setCopied] = useState(null);

  const getWorker = () => workers.find(w => w.status === 'online') || workers[0];

  // Sample payloads for quick testing
  const samplePayloads = [
    {
      name: 'Message Received',
      payload: {
        event: 'message',
        session: 'my-session',
        timestamp: new Date().toISOString(),
        data: {
          id: 'ABC123',
          from: '628123456789@s.whatsapp.net',
          fromMe: false,
          body: 'Hello, this is a test message!',
          type: 'text',
          hasMedia: false,
        },
      },
    },
    {
      name: 'Session Status',
      payload: {
        event: 'session.status',
        session: 'my-session',
        timestamp: new Date().toISOString(),
        data: {
          status: 'WORKING',
          phone: '628123456789',
          pushName: 'Test User',
        },
      },
    },
    {
      name: 'Message ACK',
      payload: {
        event: 'message.ack',
        session: 'my-session',
        timestamp: new Date().toISOString(),
        data: {
          id: 'ABC123',
          from: '628123456789@s.whatsapp.net',
          ack: 3,
          ackName: 'READ',
        },
      },
    },
    {
      name: 'Group Join',
      payload: {
        event: 'group.v2.join',
        session: 'my-session',
        timestamp: new Date().toISOString(),
        data: {
          group: {
            id: '120363123456789@g.us',
            subject: 'Test Group',
          },
          participants: [
            { id: '628123456789@s.whatsapp.net' },
          ],
        },
      },
    },
  ];

  const handleTest = async () => {
    if (!url) {
      toast.error('Please enter a webhook URL');
      return;
    }

    const worker = getWorker();
    if (!worker) {
      toast.error('No worker connected');
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;

      // Parse custom headers
      let parsedHeaders = {};
      if (customHeaders.trim()) {
        try {
          parsedHeaders = JSON.parse(customHeaders);
        } catch (e) {
          toast.error('Invalid JSON in custom headers');
          setTesting(false);
          return;
        }
      }

      // Parse custom payload
      let parsedPayload = null;
      if (useCustomPayload && customPayload.trim()) {
        try {
          parsedPayload = JSON.parse(customPayload);
        } catch (e) {
          toast.error('Invalid JSON in custom payload');
          setTesting(false);
          return;
        }
      }

      const response = await fetch(`${worker.url}/api/webhooks/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url,
          headers: parsedHeaders,
          payload: parsedPayload,
        }),
      });

      const data = await response.json();
      setResult(data.data);
      
      if (data.data?.success) {
        toast.success(`Test successful! Status: ${data.data.status}`);
      } else {
        toast.error(`Test failed: ${data.data?.error || data.data?.statusText || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to run test: ' + error.message);
      setResult({
        success: false,
        error: error.message,
        errorCode: 'NETWORK_ERROR',
      });
    } finally {
      setTesting(false);
    }
  };

  const loadSamplePayload = (sample) => {
    setCustomPayload(JSON.stringify(sample.payload, null, 2));
    setUseCustomPayload(true);
    toast.success(`Loaded "${sample.name}" payload`);
  };

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // Show connect prompt if no workers
  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Server className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Workers Connected</h2>
        <p className="text-gray-500 mb-4">Connect a WhatsApp Gateway server to test webhooks</p>
        <a href="/workers" className="btn btn-primary">Connect Server</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Webhook Tester</h1>
        <p className="text-gray-500 mt-1">Test and debug your webhook endpoints</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Request */}
        <div className="space-y-4">
          {/* URL Input */}
          <div className="card">
            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL *</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="input w-full"
                  placeholder="https://your-server.com/webhook"
                />
              </div>

              {/* Custom Headers */}
              <div>
                <label className="block text-sm font-medium mb-2">Custom Headers (JSON)</label>
                <textarea
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  className="input w-full font-mono text-sm"
                  rows={3}
                  placeholder='{"Authorization": "Bearer token123"}'
                />
              </div>

              {/* Custom Payload Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useCustomPayload"
                  checked={useCustomPayload}
                  onChange={(e) => setUseCustomPayload(e.target.checked)}
                  className="w-4 h-4 rounded bg-dark-800 border-dark-600"
                />
                <label htmlFor="useCustomPayload" className="text-sm">Use custom payload</label>
              </div>

              {/* Custom Payload */}
              {useCustomPayload && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Custom Payload (JSON)</label>
                    <div className="flex gap-2">
                      {samplePayloads.map((sample, idx) => (
                        <button
                          key={idx}
                          onClick={() => loadSamplePayload(sample)}
                          className="text-xs px-2 py-1 bg-dark-800 hover:bg-dark-700 rounded text-gray-400 hover:text-white transition-colors"
                        >
                          {sample.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={customPayload}
                    onChange={(e) => setCustomPayload(e.target.value)}
                    className="input w-full font-mono text-sm"
                    rows={12}
                    placeholder='{"event": "message", "data": {...}}'
                  />
                </div>
              )}

              {/* Test Button */}
              <button
                onClick={handleTest}
                disabled={testing || !url}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Send Test Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Response */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Status Card */}
              <div className={`card border ${result.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      ) : (
                        <XCircle className="w-8 h-8 text-red-500" />
                      )}
                      <div>
                        <h3 className="text-xl font-bold">
                          {result.success ? 'Success' : 'Failed'}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {result.status} {result.statusText}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span className="font-mono">{result.responseTime}ms</span>
                    </div>
                  </div>
                  {result.error && (
                    <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
                      <p className="text-sm text-red-400">
                        <strong>Error:</strong> {result.error}
                        {result.errorCode && <span className="ml-2 text-xs text-gray-500">({result.errorCode})</span>}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Request Payload */}
              <div className="card">
                <button
                  onClick={() => setExpandRequest(!expandRequest)}
                  className="card-header flex items-center justify-between w-full hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandRequest ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Code className="w-4 h-4" />
                    <span className="font-medium">Request Payload</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(formatJson(result.requestPayload), 'request');
                    }}
                    className="p-1 hover:bg-dark-700 rounded"
                  >
                    {copied === 'request' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </button>
                {expandRequest && (
                  <div className="card-body pt-0">
                    <pre className="text-xs text-gray-400 overflow-x-auto bg-dark-900 p-3 rounded-lg max-h-64 overflow-y-auto">
                      {formatJson(result.requestPayload)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Response Data */}
              {result.responseData && (
                <div className="card">
                  <button
                    onClick={() => setExpandResponse(!expandResponse)}
                    className="card-header flex items-center justify-between w-full hover:bg-dark-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandResponse ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Code className="w-4 h-4" />
                      <span className="font-medium">Response Data</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(formatJson(result.responseData), 'response');
                      }}
                      className="p-1 hover:bg-dark-700 rounded"
                    >
                      {copied === 'response' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </button>
                  {expandResponse && (
                    <div className="card-body pt-0">
                      <pre className="text-xs text-gray-400 overflow-x-auto bg-dark-900 p-3 rounded-lg max-h-64 overflow-y-auto">
                        {formatJson(result.responseData)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Response Headers */}
              {result.responseHeaders && (
                <div className="card">
                  <div className="card-header">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      <span className="font-medium">Response Headers</span>
                    </div>
                  </div>
                  <div className="card-body pt-0">
                    <div className="space-y-1">
                      {Object.entries(result.responseHeaders).slice(0, 10).map(([key, value]) => (
                        <div key={key} className="flex text-xs font-mono">
                          <span className="text-primary-400 w-40 flex-shrink-0">{key}:</span>
                          <span className="text-gray-400 truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="card-body text-center py-16">
                <Send className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ready to Test</h3>
                <p className="text-gray-500">
                  Enter a webhook URL and click "Send Test Request" to see the response
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="card bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/20">
        <div className="card-body">
          <h3 className="font-semibold mb-2">💡 Tips</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• The test request includes a signature header (<code className="text-primary-400">X-Webhook-Signature</code>) for verification</li>
            <li>• Use custom payloads to test how your endpoint handles different event types</li>
            <li>• Response time is measured from request sent to response received</li>
            <li>• Use tools like <a href="https://webhook.site" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">webhook.site</a> or <a href="https://requestbin.com" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">requestbin.com</a> to test incoming webhooks</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WebhookTester;
