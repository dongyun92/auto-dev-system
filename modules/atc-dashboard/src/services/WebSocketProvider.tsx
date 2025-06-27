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
    const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:8080/ws/adsb/realtime';
    
    const stompClient = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      debug: (str) => {
        if (process.env.REACT_APP_ENABLE_DEBUG === 'true') {
          console.log('STOMP: ' + str);
        }
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('Connected to STOMP WebSocket');
        setIsConnected(true);
        
        // Subscribe to aircraft tracking topic
        stompClient.subscribe('/topic/tracking', (message: IMessage) => {
          try {
            const aircraftData = JSON.parse(message.body);
            setAircraft(aircraftData);
            // Commented out to reduce console noise
            // if (process.env.REACT_APP_ENABLE_DEBUG === 'true') {
            //   console.log(`Received ${aircraftData.length} aircraft`);
            // }
          } catch (error) {
            console.error('Error parsing aircraft data:', error);
          }
        }, {
          ack: 'auto'
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
      },
      onWebSocketClose: (event) => {
        console.log('WebSocket closed:', event);
        setIsConnected(false);
        // The client will automatically reconnect due to reconnectDelay setting
      }
    });

    // Activate the client
    try {
      stompClient.activate();
      setClient(stompClient);
      console.log('WebSocket client activated, attempting connection to:', wsUrl);
    } catch (error) {
      console.error('Failed to activate WebSocket client:', error);
      setIsConnected(false);
    }

    return () => {
      if (stompClient.active) {
        stompClient.deactivate();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ client, aircraft, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};