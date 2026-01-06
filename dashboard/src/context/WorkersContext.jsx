import { createContext, useContext, useState, useEffect } from 'react';

const WorkersContext = createContext(null);

const WORKERS_STORAGE_KEY = 'wa_gateway_workers';

export const WorkersProvider = ({ children }) => {
  const [workers, setWorkersState] = useState([]);
  const [activeWorker, setActiveWorkerState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = () => {
    try {
      const stored = localStorage.getItem(WORKERS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      setWorkersState(parsed);
      // Set first worker as active if exists
      if (parsed.length > 0 && !activeWorker) {
        setActiveWorkerState(parsed[0]);
      }
    } catch (e) {
      console.error('Failed to load workers:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveWorkers = (newWorkers) => {
    localStorage.setItem(WORKERS_STORAGE_KEY, JSON.stringify(newWorkers));
    setWorkersState(newWorkers);
  };

  const addWorker = async (worker) => {
    const newWorker = {
      id: Date.now().toString(),
      name: worker.name,
      url: worker.url.replace(/\/$/, ''), // Remove trailing slash
      apiKey: worker.apiKey || '',
      status: 'unknown',
      createdAt: new Date().toISOString(),
    };
    
    // Check connection
    const status = await checkWorkerStatus(newWorker);
    newWorker.status = status.status;
    newWorker.statusMessage = status.message;
    
    const updated = [...workers, newWorker];
    saveWorkers(updated);
    
    // Set as active if first worker
    if (updated.length === 1) {
      setActiveWorkerState(newWorker);
    }
    
    return newWorker;
  };

  const updateWorker = async (id, updates) => {
    const updated = workers.map(w => {
      if (w.id === id) {
        return { ...w, ...updates, url: updates.url?.replace(/\/$/, '') || w.url };
      }
      return w;
    });
    saveWorkers(updated);
    
    // Update active worker if it was modified
    if (activeWorker?.id === id) {
      const updatedWorker = updated.find(w => w.id === id);
      setActiveWorkerState(updatedWorker);
    }
  };

  const removeWorker = (id) => {
    const updated = workers.filter(w => w.id !== id);
    saveWorkers(updated);
    
    // If removed active worker, set first remaining as active
    if (activeWorker?.id === id) {
      setActiveWorkerState(updated.length > 0 ? updated[0] : null);
    }
  };

  const setActiveWorker = (worker) => {
    setActiveWorkerState(worker);
  };

  const checkWorkerStatus = async (worker) => {
    try {
      const headers = {};
      if (worker.apiKey) headers['x-api-key'] = worker.apiKey;
      
      // Use /api/sessions to properly test auth (health endpoint doesn't require auth)
      const response = await fetch(`${worker.url}/api/sessions`, { headers });
      
      if (response.status === 401 || response.status === 403) {
        return { status: 'error', message: 'Invalid API Key' };
      }
      
      if (response.ok) {
        return { status: 'online', message: 'Connected' };
      }
      
      return { status: 'offline', message: `Server error (${response.status})` };
    } catch (e) {
      return { status: 'offline', message: 'Cannot connect' };
    }
  };

  const refreshWorkerStatuses = async () => {
    const updated = await Promise.all(
      workers.map(async (worker) => {
        const status = await checkWorkerStatus(worker);
        return { ...worker, status: status.status, statusMessage: status.message };
      })
    );
    saveWorkers(updated);
  };

  // Get worker by ID
  const getWorkerById = (id) => workers.find(w => w.id === id);

  const value = {
    workers,
    activeWorker,
    loading,
    addWorker,
    updateWorker,
    removeWorker,
    setActiveWorker,
    refreshWorkerStatuses,
    checkWorkerStatus,
    getWorkerById,
  };

  return (
    <WorkersContext.Provider value={value}>
      {children}
    </WorkersContext.Provider>
  );
};

export const useWorkers = () => {
  const context = useContext(WorkersContext);
  if (!context) {
    throw new Error('useWorkers must be used within a WorkersProvider');
  }
  return context;
};
