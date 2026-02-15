import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

let idCounter = 0;

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addToast = useCallback((message, type = 'info', duration) => {
    const id = ++idCounter;
    const autoClose = duration ?? (type === 'error' ? 5000 : 3000);
    setToasts(prev => [...prev, { id, message, type }]);
    timersRef.current[id] = setTimeout(() => removeToast(id), autoClose);
    return id;
  }, [removeToast]);

  const toast = useCallback({
    success: (msg, d) => addToast(msg, 'success', d),
    error: (msg, d) => addToast(msg, 'error', d),
    info: (msg, d) => addToast(msg, 'info', d),
    warning: (msg, d) => addToast(msg, 'warning', d),
  }, [addToast]);

  // Fix: useCallback can't return an object, use useMemo pattern instead
  return (
    <ToastContext.Provider value={{ success: (m,d) => addToast(m,'success',d), error: (m,d) => addToast(m,'error',d), info: (m,d) => addToast(m,'info',d), warning: (m,d) => addToast(m,'warning',d) }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`} onClick={() => removeToast(t.id)}>
            <span className="toast-icon">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'info' && 'ℹ'}
              {t.type === 'warning' && '⚠'}
            </span>
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
