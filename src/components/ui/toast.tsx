"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import clsx from "clsx";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (item: Omit<ToastItem, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, message, type }: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, message, type }]);
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => toast({ title, message, type: "success" }),
    [toast]
  );

  const error = useCallback(
    (title: string, message?: string) => toast({ title, message, type: "error" }),
    [toast]
  );

  const info = useCallback(
    (title: string, message?: string) => toast({ title, message, type: "info" }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={clsx(
                "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all",
                t.type === "success" && "bg-surface-card/95 border-accent/40 text-foreground",
                t.type === "error" && "bg-surface-card/95 border-danger/40 text-foreground",
                t.type === "info" && "bg-surface-card/95 border-primary/40 text-foreground"
              )}
            >
              {t.type === "success" && (
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              )}
              {t.type === "error" && (
                <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
              )}
              {t.type === "info" && (
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold">{t.title}</h4>
                {t.message && <p className="text-xs text-muted mt-0.5 line-clamp-2">{t.message}</p>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-muted hover:text-foreground hover:scale-110 active:scale-95 transition-transform"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
