'use client';

import React, { useState, useEffect } from 'react';
import PatternAlert, { PatternAlertData } from './PatternAlert';

interface AlertManagerProps {
  wsConnection?: WebSocket | null;
  onPatternAlert?: (alert: PatternAlertData) => void;
}

export default function AlertManager({ wsConnection, onPatternAlert }: AlertManagerProps) {
  const [alerts, setAlerts] = useState<(PatternAlertData & { id: string })[]>([]);
  const subscribed = React.useRef<boolean>(false);

  // Function to manually trigger a test bullish alert
  const triggerTestAlert = React.useCallback(() => {
    const testAlert: PatternAlertData = {
      topic: "pattern_detection",
      data: {
        ticker: "NVDA",
        pattern: "bullish_reversal",
        pattern_display_name: "Bullish Reversal",
        price: 132.50,
        timestamp: new Date().toISOString(),
        confidence: 0.75,
        alert_level: "medium",
        message: "Bullish Reversal detected for NVDA at $132.50 (75% confidence)",
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

  // Function to manually trigger a test bearish alert
  const triggerTestBearishAlert = React.useCallback(() => {
    const testAlert: PatternAlertData = {
      topic: "pattern_detection",
      data: {
        ticker: "NVDA",
        pattern: "bearish_reversal",
        pattern_display_name: "Bearish Reversal",
        price: 128.75,
        timestamp: new Date().toISOString(),
        confidence: 0.82,
        alert_level: "high",
        message: "Bearish Reversal detected for NVDA at $128.75 (82% confidence)",
        is_bullish: false,
        is_bearish: true,
        direction: "bearish",
        metadata: {
          detection_type: "natural",
          duration_minutes: 8.0,
          stage: 2
        }
      }
    };
    handleNewAlert(testAlert);
  }, []);

  // Expose test functions globally for development
  React.useEffect(() => {
    (window as Window & { triggerPatternAlert?: () => void; triggerBearishAlert?: () => void }).triggerPatternAlert = triggerTestAlert;
    (window as Window & { triggerPatternAlert?: () => void; triggerBearishAlert?: () => void }).triggerBearishAlert = triggerTestBearishAlert;
    return () => {
      delete (window as Window & { triggerPatternAlert?: () => void; triggerBearishAlert?: () => void }).triggerPatternAlert;
      delete (window as Window & { triggerPatternAlert?: () => void; triggerBearishAlert?: () => void }).triggerBearishAlert;
    };
  }, [triggerTestAlert, triggerTestBearishAlert]);

  const handleNewAlert = React.useCallback((alert: PatternAlertData) => {
    const alertWithId = {
      ...alert,
      id: Date.now().toString()
    };
    
    setAlerts(prev => [...prev, alertWithId]);
    
    // Play bell sound
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfCCqO2O+/dioAHHTY8+CWRQ0PVqzl9rNUEw1FqOL2u2QeByWF2vG9diQ');
      audio.volume = 0.3;
      audio.play().catch(err => console.warn('Could not play alert sound:', err));
    } catch (err) {
      console.warn('Audio not supported:', err);
    }
    
    // Call the callback if provided
    if (onPatternAlert) {
      onPatternAlert(alert);
    }
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alertWithId.id));
    }, 10000);
  }, [onPatternAlert]);

  // Subscribe to pattern alerts using existing WebSocket connection
  useEffect(() => {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
      subscribed.current = false;
      return;
    }

    // Subscribe to pattern detection topic if not already subscribed
    if (!subscribed.current) {
      const subscribeMessage = {
        type: "subscribe",
        topic: "pattern"
      };
      wsConnection.send(JSON.stringify(subscribeMessage));
      subscribed.current = true;
      console.log('🔔 AlertManager: Subscribed to pattern alerts');
    }

    // Add message listener for pattern alerts
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.topic === "pattern_detection") {
          console.log('🚨 NEW PATTERN ALERT:', {
            ticker: data.data?.ticker,
            pattern: data.data?.pattern_display_name,
            direction: data.data?.direction,
            price: data.data?.price,
            confidence: data.data?.confidence,
            alert_level: data.data?.alert_level
          });
          handleNewAlert(data);
        }
      } catch (error) {
        console.error("🔔 AlertManager: Error parsing pattern alert:", error);
      }
    };

    wsConnection.addEventListener('message', handleMessage);

    return () => {
      wsConnection.removeEventListener('message', handleMessage);
    };
  }, [wsConnection, handleNewAlert]);

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