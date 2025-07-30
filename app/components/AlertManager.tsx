'use client';

import React, { useState, useEffect } from 'react';
import PatternAlert, { PatternAlertData } from './PatternAlert';

interface AlertManagerProps {
  wsConnection?: WebSocket | null;
  onPatternAlert?: (alert: PatternAlertData) => void;
}

const AlertManager = React.forwardRef<{ handleNewAlert: (alert: PatternAlertData) => void }, AlertManagerProps>(
  ({ wsConnection, onPatternAlert }, ref) => {
  const [alerts, setAlerts] = useState<(PatternAlertData & { id: string })[]>([]);
  const subscribed = React.useRef<boolean>(false);
  const alertIdCounter = React.useRef<number>(0);
  const timeoutRefs = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

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

  // Function to play alert sound using Web Audio API
  const playAlertSound = React.useCallback((audioContext: AudioContext, isBullish: boolean) => {
    if (isBullish) {
      // Bullish: Pleasant ascending chime (C-E-G major chord)
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      frequencies.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + i * 0.1 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.1 + 0.4);
        
        oscillator.start(audioContext.currentTime + i * 0.1);
        oscillator.stop(audioContext.currentTime + i * 0.1 + 0.4);
      });
    } else {
      // Bearish: Warning descending tone (G-D-A minor)
      const frequencies = [783.99, 587.33, 440]; // G5, D5, A4
      frequencies.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + i * 0.15 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.5);
        
        oscillator.start(audioContext.currentTime + i * 0.15);
        oscillator.stop(audioContext.currentTime + i * 0.15 + 0.5);
      });
    }
  }, []);

  // Fallback sound using HTML5 Audio API
  const playFallbackSound = React.useCallback(() => {
    try {
      // Create a simple beep sound using data URL
      const audioElement = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUdBzaF0fPTgjEGgIN+W2J7VGpvXeXt6rdfOSNnT5d8qZSoWo9oe7e6/Kk1QQF7VY+fmJGHgn9kWWFyblF7VVhSdWJpbFJ6V1pSdGJpbVJ5VVtYeWJgaE5tYWVWcV9nYk5sX2NXc19lb1JvXmZWcF9nY05tXmRXcl9lblJvXmVVcWJmXE5jX2hWcVpoYU5pY2VacWJnXVBhYGhYdF5hZVN4XGRad2FhY1J3YmZYdGBiYVJ4YmVaeGBhY1J4YGFTd2FhZVN4XmJYdWFjXVJpYmlaclhZW3dtdT6Zqpd8Y1xqTJfOxIuHOlx8LJbLz5ZOJWNnY2NeWXdrY2FbX3VeZmVSdWNjVHFgYWNSdGJkVXNdZmNRe2RfVHNeYmNSeGBiVHJfZGJTeFxlW3NgYGNUeF5nVXNiYmJSd2JmVnNfY2NSeGBlVHViZWRTeF5lUndfZWNRdWJmVnNfY2NSeGBlVHNiZWRTeFxnXHJgYGNUeF5nVnJhZGVTdWJlU3dgZGNRdWJnVnJhZGVTdVxnXXNgYGNUeGFgU3diZGVTeFxnXHJhZGVUeGBmUndfZWNRdGFnWXRdZGNSd2FmWHZaZWVUd11nXXRhYWNUeGBmUndfZWNSdGFnVnNiZGRTc2FmVnNiZGRSdWFmU3diZWVTdFxlYHNfZGNRdGBlU3NhZGNSd2BmVnNfY2NSeF9lU3diZGNSd2BlUnZhZGNSdGFnVnNiZGVTdF5kXXBhYWFUeGBlVXVcZGNSeGBmU3dhZGVUeFxoVXJhZGVUd19kUnViZGNSdGFmVXNhZGVSd19mVHVhZGVUd2BkVXVhZGVTeF5nUnVhZGVTd1xmXHNfYWFUeGFlUnViZWRTdF5mXXNgYGJUeWFgUnVhZGVTd2BkU3VhZmNTdl5mXXVgYGJUeWBmUndhZWVTd2BlU3RhZGVUeFxmXXNgYWJUeGFmUnVhZGRTdWFmVHVhZGVSd19mXHNfYWNTdWFmU3VhZGVTd2BmUnVhZWVTdWBmXHJgYWNUeWBmU3VhZGRTdWFmVHVhZGVTdl9mXHNfYWJTdWFmU3VhZGVSd19mXHNfYWJTeWBmU3VhZGRTdWFmVHVhZGVSd19mXHJfYWNTdWFmU3VhZGVSd2BmVHVhZWVSdWBmXHJfYWNSdWFmU3VhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdWBmXHJfYWNTdGFmVnVhZGVSd2BmVHVhZWVSdW==');
      audioElement.volume = 0.3;
      audioElement.play().catch(err => {
        console.warn('Fallback audio also failed:', err);
      });
    } catch (err) {
      console.warn('Fallback audio not supported:', err);
    }
  }, []);

  const handleNewAlert = React.useCallback((alert: PatternAlertData) => {
    // Defensive check for alert structure
    if (!alert.data || !alert.data.ticker || !alert.data.direction) {
      console.error('AlertManager: Invalid alert structure:', alert);
      return;
    }

    const alertWithId = {
      ...alert,
      id: `alert-${++alertIdCounter.current}`
    };
    
    setAlerts(prev => [...prev, alertWithId]);
    console.log(`AlertManager: Added alert ${alertWithId.id} for ${alert.data.ticker}`);
    
    // Play alert sound (client-side only)
    if (typeof window !== 'undefined') {
      try {
        const audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
        
        console.log(`AlertManager: AudioContext state: ${audioContext.state}`);
        
        if (audioContext.state === 'suspended') {
          console.log('AudioContext suspended, attempting to resume...');
          audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully');
            playAlertSound(audioContext, alert.data.is_bullish);
          }).catch(err => {
            console.warn('Failed to resume AudioContext:', err);
            playFallbackSound();
          });
        } else {
          playAlertSound(audioContext, alert.data.is_bullish);
        }
      } catch (err) {
        console.warn('Web Audio API not supported, trying fallback:', err);
        playFallbackSound();
      }
    }
    
    // Call the callback if provided
    if (onPatternAlert) {
      onPatternAlert(alert);
    }
    
    // Auto-dismiss after 5 seconds with proper timeout management
    const timeoutId = setTimeout(() => {
      console.log(`AlertManager: Auto-dismissing alert ${alertWithId.id} after 5 seconds`);
      setAlerts(prev => prev.filter(a => a.id !== alertWithId.id));
      timeoutRefs.current.delete(alertWithId.id);
    }, 5000);
    
    // Store the timeout reference for cleanup
    timeoutRefs.current.set(alertWithId.id, timeoutId);
  }, [onPatternAlert, playAlertSound, playFallbackSound]);

  // Expose handleNewAlert via ref
  React.useImperativeHandle(ref, () => ({
    handleNewAlert
  }), [handleNewAlert]);

  // Note: Subscription to pattern_detection is now handled by StockTable component
  // in the ws.onopen handler alongside stock subscriptions for better timing and reliability.
  // Message handling is also done by StockTable which calls onPatternAlert callback
  // when pattern detection messages are received.

  // Cleanup effect to clear all timeouts on unmount
  React.useEffect(() => {
    return () => {
      // Clear all pending timeouts when component unmounts
      timeoutRefs.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current.clear();
      console.log('AlertManager: Cleaned up all timeouts on unmount');
    };
  }, []);

  const dismissAlert = (id: string) => {
    console.log(`AlertManager: Manually dismissing alert ${id}`);
    
    // Clear the timeout if it exists
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    
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
});

AlertManager.displayName = 'AlertManager';

export default AlertManager;