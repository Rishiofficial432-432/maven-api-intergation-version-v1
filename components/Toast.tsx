import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info, Bell } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'default';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const Toast: React.FC<{ message: ToastMessage; onDismiss: (id: number) => void }> = ({ message, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(message.id), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(message.id), 300);
  };

  const icons: { [key in ToastType]: ReactNode } = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertTriangle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    default: <Bell className="w-5 h-5 text-gray-400" />,
  };
  
  const baseClasses = "flex items-center w-full max-w-xs p-4 space-x-3 text-gray-300 bg-card border border-border rounded-lg shadow-lg transform transition-all duration-300";
  const animationClasses = isExiting
    ? 'opacity-0 translate-y-4'
    : 'opacity-100 translate-y-0';

  return (
    <div className={`${baseClasses} ${animationClasses}`}>
      <div className="flex-shrink-0">{icons[message.type]}</div>
      <div className="text-sm font-normal flex-1">{message.message}</div>
      <button
        onClick={handleDismiss}
        className="-mx-1.5 -my-1.5 bg-card text-gray-400 hover:text-gray-100 hover:bg-secondary rounded-lg focus:ring-2 focus:ring-gray-600 p-1.5 inline-flex h-8 w-8 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'default') => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
  }, []);
  
  const success = (message: string) => addToast(message, 'success');
  const error = (message: string) => addToast(message, 'error');
  const info = (message: string) => addToast(message, 'info');

  const removeToast = (id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast, success, error, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
