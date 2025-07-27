'use client';

import React, { useState, useEffect } from 'react';
import PatternAlert, { PatternAlertData } from './PatternAlert';

interface AlertManagerProps {
  wsUrl?: string;
  onPatternAlert?: (alert: PatternAlertData) => void;
}

export default function AlertManager({ wsUrl, onPatternAlert }: AlertManagerProps) {
  const [alerts, setAlerts] = useState<(PatternAlertData & { id: string })[]>([]);
  const wsRef = React.useRef<WebSocket | null>(null);

  // Function to manually trigger a test alert
  const triggerTestAlert = React.useCallback(() => {
    const testAlert: PatternAlertData = {
      topic: "pattern_detection",
      data: {
        ticker: "LOOP",
        pattern: "bullish_reversal",
        pattern_display_name: "Bullish Reversal",
        price: 1.64,
        timestamp: new Date().toISOString(),
        confidence: 0.75,
        alert_level: "medium",
        message: "Bullish Reversal detected for LOOP at $1.64 (75% confidence)",
        is_bullish: true,
        is_bearish: false,
        direction: "bullish",
        metadata: {
          detection_type: "natural",
          duration_minutes: 5.0,
          stage: 1
        }
      }
    };
    handleNewAlert(testAlert);
  }, []);

  // Expose test function globally for development
  React.useEffect(() => {
    (window as any).triggerPatternAlert = triggerTestAlert;
    return () => {
      delete (window as any).triggerPatternAlert;
    };
  }, [triggerTestAlert]);

  const handleNewAlert = React.useCallback((alert: PatternAlertData) => {
    const alertWithId = {
      ...alert,
      id: Date.now().toString()
    };
    
    setAlerts(prev => [...prev, alertWithId]);
    
    // Call the callback if provided
    if (onPatternAlert) {
      onPatternAlert(alert);
    }
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alertWithId.id));
    }, 10000);
  }, [onPatternAlert]);

  // WebSocket connection for pattern alerts
  useEffect(() => {
    if (!wsUrl) return;

    const connectWebSocket = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Pattern alert WebSocket connected');
        // Subscribe to pattern detection topic
        const subscribeMessage = {
          type: "subscribe",
          topic: "pattern"
        };
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.topic === "pattern_detection") {
            handleNewAlert(data);
          }
        } catch (error) {
          console.error("Error parsing pattern alert:", error);
        }
      };

      ws.onclose = () => {
        console.log('Pattern alert WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error("Pattern alert WebSocket error:", error);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [wsUrl, handleNewAlert]);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {alerts.map((alert) => (
        <PatternAlert
          key={alert.id}
          alert={alert}
          onDismiss={() => dismissAlert(alert.id)}
        />
      ))}
    </div>
  );
}