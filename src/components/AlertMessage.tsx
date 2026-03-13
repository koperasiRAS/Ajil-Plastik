/**
 * Reusable Alert Message Component
 * Replaces duplicated message state and display logic across 8+ files
 */

import { useEffect, useState } from 'react';

export type AlertType = 'success' | 'error';

export interface AlertMessageProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
  autoDismiss?: number; // milliseconds, 0 = no auto dismiss
}

export function AlertMessage({ type, message, onClose, autoDismiss = 0 }: AlertMessageProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onClose]);

  if (!visible) return null;

  return (
    <div className={`mb-4 ${type === 'success' ? 'alert-success' : 'alert-error'} flex items-center justify-between`}>
      <span>{message}</span>
      {onClose && (
        <button
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * Hook for managing alert message state
 * Replaces duplicated useState pattern across multiple files
 */
export interface UseAlertReturn {
  alert: { type: AlertType; message: string } | null;
  setAlert: (type: AlertType, message: string) => void;
  setSuccess: (message: string) => void;
  setError: (message: string) => void;
  clearAlert: () => void;
}

export function useAlert(autoDismissMs = 3000): UseAlertReturn {
  const [alert, setAlertState] = useState<{ type: AlertType; message: string } | null>(null);

  const setAlert = (type: AlertType, message: string) => {
    setAlertState({ type, message });
  };

  const setSuccess = (message: string) => {
    setAlertState({ type: 'success', message });
  };

  const setError = (message: string) => {
    setAlertState({ type: 'error', message });
  };

  const clearAlert = () => {
    setAlertState(null);
  };

  // Auto dismiss
  useEffect(() => {
    if (alert && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        setAlertState(null);
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [alert, autoDismissMs]);

  return { alert, setAlert, setSuccess, setError, clearAlert };
}
