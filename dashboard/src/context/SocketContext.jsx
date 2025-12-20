import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { apiKey, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!isAuthenticated || !apiKey) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create socket connection with API key
    const newSocket = io(window.location.origin, {
      auth: { apiKey },
      query: { apiKey },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('sessions:state', (data) => {
      setSessions(data);
    });

    newSocket.on('event', (data) => {
      setEvents((prev) => [data, ...prev].slice(0, 100));
    });

    newSocket.on('session:connected', (data) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.name === data.session
            ? { ...s, status: 'connected', phone: data.phone, pushName: data.pushName }
            : s
        )
      );
    });

    newSocket.on('session:disconnected', (data) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.name === data.session ? { ...s, status: 'disconnected' } : s
        )
      );
    });

    newSocket.on('session:qr', (data) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.name === data.session ? { ...s, status: 'qr', qrBase64: data.qrBase64 } : s
        )
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, apiKey]);

  const value = {
    socket,
    connected,
    sessions,
    setSessions,
    events,
    clearEvents: () => setEvents([]),
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
