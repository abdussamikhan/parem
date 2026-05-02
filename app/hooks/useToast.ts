'use client';
/**
 * app/hooks/useToast.ts
 * Lightweight toast system — no external deps.
 */
import { useState, useCallback, useRef } from 'react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id:      string;
  kind:    ToastKind;
  title:   string;
  message?: string;
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const toast = useCallback((kind: ToastKind, title: string, message?: string, durationMs = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(t => [...t.slice(-4), { id, kind, title, message }]);
    timers.current[id] = setTimeout(() => dismiss(id), durationMs);
    return id;
  }, [dismiss]);

  const success = useCallback((title: string, message?: string) => toast('success', title, message), [toast]);
  const error   = useCallback((title: string, message?: string) => toast('error',   title, message, 6000), [toast]);
  const warning = useCallback((title: string, message?: string) => toast('warning', title, message), [toast]);
  const info    = useCallback((title: string, message?: string) => toast('info',    title, message), [toast]);

  return { toasts, dismiss, success, error, warning, info };
}
