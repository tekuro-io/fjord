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
        ticker: "SNAP",
        pattern: "bullish_reversal",
        pattern_display_name: "Bullish Reversal",
        price: 1.853398835896824,
        timestamp: new Date().toISOString(),
        confidence: 0.75,
        alert_level: "medium",
        message: "Bullish Reversal detected for SNAP at $1.85 (75% confidence)",
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
    // Defensive check for alert structure
    if (!alert.data || !alert.data.ticker || !alert.data.direction) {
      console.error('🔔 AlertManager: Invalid alert structure:', alert);
      return;
    }

    const alertWithId = {
      ...alert,
      id: Date.now().toString()
    };
    
    setAlerts(prev => [...prev, alertWithId]);
    
    // Play different sounds based on alert direction
    try {
      const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      
      if (alert.data.is_bullish) {
        // Bullish: Pleasant ascending chime (C-E-G major chord)
        const playChime = async () => {
          const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
          for (let i = 0; i < frequencies.length; i++) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequencies[i], audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            oscillator.start(audioContext.currentTime + i * 0.1);
            oscillator.stop(audioContext.currentTime + i * 0.1 + 0.4);
          }
        };
        playChime();
      } else {
        // Bearish: Warning descending tone (G-D-A minor)
        const playWarning = async () => {
          const frequencies = [783.99, 587.33, 440]; // G5, D5, A4
          for (let i = 0; i < frequencies.length; i++) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequencies[i], audioContext.currentTime);
            oscillator.type = 'sawtooth';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime + i * 0.15);
            oscillator.stop(audioContext.currentTime + i * 0.15 + 0.5);
          }
        };
        playWarning();
      }
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
        topic: "pattern_detection"
      };
      wsConnection.send(JSON.stringify(subscribeMessage));
      subscribed.current = true;
      console.log('🔔 AlertManager: Subscribed to pattern alerts');
    }

    // Note: Message handling is now done by StockTable component
    // which calls onPatternAlert callback when pattern detection messages are received
    // This prevents duplicate message handling and the associated errors
  }, [wsConnection]);

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