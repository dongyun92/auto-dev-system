import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { TrackedAircraft } from '../types';

interface WebSocketContextType {
  client: Client | null;
  aircraft: TrackedAircraft[];
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  client: null,
  aircraft: [],
  isConnected: false,
});

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [client, setClient] = useState<Client | null>(null);
  const [aircraft, setAircraft] = useState<TrackedAircraft[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const stompClient = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws/adsb/realtime'),
      debug: (str) => {
        console.log('STOMP: ' + str);
      },
      onConnect: () => {
        console.log('Connected to STOMP WebSocket');
        setIsConnected(true);
        
        // Subscribe to aircraft tracking topic
        stompClient.subscribe('/topic/tracking', (message: IMessage) => {
          try {
            const aircraftData = JSON.parse(message.body);
            setAircraft(aircraftData);
            console.log('Received aircraft data:', aircraftData);
          } catch (error) {
            console.error('Error parsing aircraft data:', error);
          }
        });
      },
      onDisconnect: () => {
        console.log('Disconnected from STOMP WebSocket');
        setIsConnected(false);
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
        setIsConnected(false);
      },
      onWebSocketError: (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      }
    });

    stompClient.activate();
    setClient(stompClient);

    return () => {
      stompClient.deactivate();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ client, aircraft, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};