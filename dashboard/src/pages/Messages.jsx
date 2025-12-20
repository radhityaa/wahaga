import { useState, useEffect } from 'react';
import { useWorkers } from '../context/WorkersContext';
import toast from 'react-hot-toast';
import { MessageSquare, Search, Server, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const Messages = () => {
  const { workers } = useWorkers();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalMessages, setTotalMessages] = useState(0);

  useEffect(() => {
    if (workers.length > 0) {
      fetchSessions();
    }
  }, [workers]);

  useEffect(() => {
    if (selectedSession) {
      setPage(1); // Reset page when session changes
      fetchMessages();
    }
  }, [selectedSession]);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages();
    }
  }, [page, perPage]);

  const getWorker = () => workers.find(w => w.status === 'online') || workers[0];

  const fetchSessions = async () => {
    const worker = getWorker();
    if (!worker) return;
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      const res = await fetch(`${worker.url}/api/sessions`, { headers });
      const data = await res.json();
      setSessions(data.data || []);
      if (data.data?.length > 0 && !selectedSession) {
        setSelectedSession(data.data[0].name);
      }
    } catch (error) {
      toast.error('Failed to fetch sessions');
    }
  };

  const fetchMessages = async () => {
    const worker = getWorker();
    if (!worker || !selectedSession) return;
    
    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      const offset = (page - 1) * perPage;
      const res = await fetch(`${worker.url}/api/messages/${selectedSession}?limit=${perPage}&offset=${offset}`, { headers });
      const data = await res.json();
      setMessages(data.data || []);
      // Backend returns pagination.total
      setTotalMessages(data.pagination?.total || data.total || data.data?.length || 0);
    } catch (error) {
      toast.error('Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  // Show connect prompt if no workers
  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Server className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Workers Connected</h2>
        <p className="text-gray-500 mb-4">Connect a WhatsApp Gateway server to view messages</p>
        <a href="/workers" className="btn btn-primary">Connect Server</a>
      </div>
    );
  }

  const filteredMessages = messages.filter((msg) => {
    if (!search) return true;
    return (
      msg.content?.toLowerCase().includes(search.toLowerCase()) ||
      msg.caption?.toLowerCase().includes(search.toLowerCase()) ||
      msg.remoteJid?.includes(search)
    );
  });

  const totalPages = Math.ceil(totalMessages / perPage) || 1;

  const formatJid = (jid) => {
    if (!jid) return 'Unknown';
    return jid.split('@')[0];
  };

  const getMessageTypeIcon = (type) => {
    const icons = {
      text: '💬',
      image: '🖼️',
      video: '🎥',
      audio: '🎵',
      document: '📄',
      location: '📍',
      contact: '👤',
      sticker: '🎨',
      reaction: '❤️',
    };
    return icons[type] || '📨';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-gray-500 mt-1">View message history for your sessions</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Session Select */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="input w-full"
              >
                <option value="">Select a session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.name}>
                    {session.name} {session.status === 'connected' && '✓'}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input w-full pl-10"
                  placeholder="Search messages..."
                />
              </div>
            </div>

            {/* Per Page */}
            <div className="w-32">
              <label className="block text-sm font-medium mb-2">Per Page</label>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="input w-full"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Refresh */}
            <button onClick={fetchMessages} className="btn btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Messages Table */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Messages</h3>
              <p className="text-gray-500">
                {selectedSession
                  ? 'No messages found for this session'
                  : 'Select a session to view messages'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Content</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Direction</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {filteredMessages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-dark-800/30">
                      <td className="px-4 py-3 text-2xl">{getMessageTypeIcon(msg.type)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{formatJid(msg.remoteJid)}</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-400">
                        {msg.content || msg.caption || `[${msg.type}]`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${msg.fromMe ? 'badge-success' : 'badge-info'}`}>
                          {msg.fromMe ? 'Sent' : 'Received'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${
                            msg.status === 'read'
                              ? 'badge-success'
                              : msg.status === 'delivered'
                              ? 'badge-info'
                              : msg.status === 'failed'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {msg.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(msg.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredMessages.length > 0 && (
          <div className="card-footer border-t border-dark-700 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((page - 1) * perPage) + 1} - {Math.min(page * perPage, totalMessages)} of {totalMessages} messages
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-outline btn-sm disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-1 rounded text-sm ${
                          page === pageNum
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-outline btn-sm disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
