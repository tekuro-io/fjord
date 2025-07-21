import { useEffect, useState, useRef, useCallback } from 'react';

interface WebSocketMessage<T = unknown> {
  data: T;
  timestamp: number;
}

interface UseWebSocketOptions {
  shouldReconnect?: boolean;
  reconnectInterval?: number;
}

/**
 * A custom React hook for managing WebSocket connections.
 * It handles connection, message reception, sending messages, and automatic reconnection.
 *
 * @param url The WebSocket server URL (e.g., 'ws://localhost:8080'). Can be null initially.
 * @param options Configuration options for the WebSocket behavior.
 * @returns An object containing connection status, error, received messages, and a send function.
 */
export const useWebSocket = <T = unknown>(
  url: string | null, // URL can be null initially if fetched dynamically
  options: UseWebSocketOptions = {}
) => {
  const { shouldReconnect = true, reconnectInterval = 3000 } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage<T> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to send messages to the WebSocket server
  const sendMessage = useCallback((message: string | ArrayBufferLike | Blob) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket not connected. Message not sent:', message);
      setError('WebSocket not connected. Cannot send message.');
    }
  }, []);

  // Effect to manage the WebSocket connection lifecycle
  useEffect(() => {
    if (!url) {
      // If URL is null, we don't attempt to connect yet
      setIsConnected(false);
      setError('WebSocket URL not provided.');
      return;
    }

    const connect = () => {
      // Clear any existing reconnect timeout before attempting a new connection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected:', url);
        setIsConnected(true);
        setError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          // Attempt to parse the message data as JSON
          const parsedData: T = JSON.parse(event.data);
          setLastMessage({
            data: parsedData,
            timestamp: Date.now(),
          });
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
          setError('Error parsing message from WebSocket server.');
        }
      };

      wsRef.current.onerror = (errEvent) => {
        console.error('WebSocket error:', errEvent);
        setError('WebSocket connection error. Attempting to reconnect...');
        setIsConnected(false);
        wsRef.current?.close(); // Ensure the connection is closed to trigger onclose
      };

      wsRef.current.onclose = (closeEvent) => {
        console.log('WebSocket disconnected:', url, closeEvent.code, closeEvent.reason);
        setIsConnected(false);
        if (shouldReconnect && closeEvent.code !== 1000) { // Code 1000 is normal closure
          console.log(`Attempting to reconnect in ${reconnectInterval / 1000} seconds...`);
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        } else if (closeEvent.code === 1000) {
          console.log('WebSocket closed normally.');
          setError(null); // Clear error on normal closure
        } else {
          setError(`WebSocket disconnected: ${closeEvent.reason || 'Unknown reason'}`);
        }
      };
    };

    // Initial connection attempt
    connect();

    // Cleanup function: close the WebSocket connection when the component unmounts
    return () => {
      if (wsRef.current) {
        console.log('Closing WebSocket on component unmount.');
        wsRef.current.close(1000, 'Component unmounted'); // 1000 is normal closure
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [url, shouldReconnect, reconnectInterval]); // Re-run effect if URL or options change

  return { isConnected, error, lastMessage, sendMessage };
};
