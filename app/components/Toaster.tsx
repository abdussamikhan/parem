'use client';
/**
 * app/components/Toaster.tsx
 * Toast notification renderer — place once per page, pass toasts + dismiss from useToast().
 */
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Toast, ToastKind } from '@/app/hooks/useToast';

const CFG: Record<ToastKind, { icon: typeof CheckCircle; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle,   color: '#6ee7b7', bg: 'rgba(16,185,129,.12)',  border: 'rgba(16,185,129,.3)' },
  error:   { icon: XCircle,       color: '#fca5a5', bg: 'rgba(239,68,68,.12)',   border: 'rgba(239,68,68,.3)'  },
  warning: { icon: AlertTriangle, color: '#fcd34d', bg: 'rgba(245,158,11,.12)',  border: 'rgba(245,158,11,.3)' },
  info:    { icon: Info,          color: '#93c5fd', bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.3)' },
};

type Props = { toasts: Toast[]; onDismiss: (id: string) => void };

export function Toaster({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <>
      <div className="toaster">
        {toasts.map(t => {
          const { icon: Icon, color, bg, border } = CFG[t.kind];
          return (
            <div key={t.id} className="toast" style={{ background: bg, borderColor: border }}>
              <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
              <div className="toast-body">
                <p className="toast-title" style={{ color }}>{t.title}</p>
                {t.message && <p className="toast-msg">{t.message}</p>}
              </div>
              <button className="toast-close" onClick={() => onDismiss(t.id)}>
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        .toaster {
          position: fixed; bottom: 1.25rem; right: 1.25rem;
          display: flex; flex-direction: column; gap: .5rem;
          z-index: 9999; max-width: 340px; width: 100%;
        }
        .toast {
          display: flex; align-items: flex-start; gap: .625rem;
          padding: .75rem 1rem; border: 1px solid; border-radius: 12px;
          backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0,0,0,.4);
          animation: toast-in .25s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(40px) scale(.95); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }
        .toast-body  { flex: 1; min-width: 0; }
        .toast-title { font-size: .8125rem; font-weight: 700; margin: 0; }
        .toast-msg   { font-size: .75rem; color: rgba(255,255,255,.55); margin: .125rem 0 0; line-height: 1.4; }
        .toast-close {
          background: none; border: none; cursor: pointer; padding: 2px;
          color: rgba(255,255,255,.3); flex-shrink: 0; border-radius: 4px;
          transition: color .15s;
        }
        .toast-close:hover { color: rgba(255,255,255,.7); }
      `}</style>
    </>
  );
}
