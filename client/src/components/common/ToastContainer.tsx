import React from 'react';
import { useToast, type ToastType } from '../../context/ToastContext.js';
import { CheckCircle2, AlertTriangle, XCircle, Info, Flame, X } from 'lucide-react';

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  sos: <Flame className="w-6 h-6 text-red-600 animate-pulse shrink-0" />,
};

const toastBorderColors: Record<ToastType, string> = {
  success: 'border-l-4 border-l-emerald-500 bg-white text-slate-800 shadow-lg',
  warning: 'border-l-4 border-l-amber-500 bg-amber-50/90 text-amber-900 shadow-lg',
  error: 'border-l-4 border-l-red-500 bg-red-50/90 text-red-900 shadow-lg',
  info: 'border-l-4 border-l-blue-500 bg-white text-slate-800 shadow-lg',
  sos: 'border-2 border-red-600 bg-red-600 text-white shadow-2xl animate-bounce',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg p-4 transition-all duration-300 flex items-start justify-between gap-3 ${toastBorderColors[toast.type]}`}
        >
          <div className="flex items-start gap-3">
            {toastIcons[toast.type]}
            <div>
              <p className="font-semibold text-sm">{toast.title}</p>
              {toast.message && (
                <p className={`text-xs mt-1 ${toast.type === 'sos' ? 'text-red-100' : 'text-slate-600'}`}>
                  {toast.message}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
