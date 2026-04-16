"use client";

import { useEffect, useRef } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  HelpCircle
} from "lucide-react";

export type DialogVariant =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "confirm";

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  variant?: DialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  destructive?: boolean;
}

const variantConfig: Record<
  DialogVariant,
  { icon: typeof Info; iconBg: string; iconColor: string; buttonClass: string }
> = {
  info: {
    icon: Info,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    buttonClass: "bg-blue-600 hover:bg-blue-700"
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700"
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    buttonClass: "bg-amber-600 hover:bg-amber-700"
  },
  error: {
    icon: XCircle,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    buttonClass: "bg-red-600 hover:bg-red-700"
  },
  confirm: {
    icon: HelpCircle,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    buttonClass: "bg-indigo-600 hover:bg-indigo-700"
  }
};

export default function AppDialog({
  open,
  onClose,
  title,
  message,
  children,
  variant = "info",
  confirmLabel,
  cancelLabel = "Close",
  onConfirm,
  destructive
}: AppDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const cfg = variantConfig[variant];
  const Icon = cfg.icon;
  const isConfirm = variant === "confirm" || !!onConfirm;
  const btnClass = destructive
    ? "bg-red-600 hover:bg-red-700"
    : cfg.buttonClass;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200 outline-none"
      >
        {/* Top accent bar */}
        <div className={`h-1 ${cfg.iconBg.replace("100", "500")}`} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 h-11 w-11 rounded-full ${cfg.iconBg} flex items-center justify-center`}
            >
              <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {message && (
                <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">
                  {message}
                </p>
              )}
              {children && <div className="mt-3">{children}</div>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 mt-6">
            {isConfirm && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                {cancelLabel}
              </button>
            )}
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                else onClose();
              }}
              className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition ${btnClass}`}
            >
              {confirmLabel || (isConfirm ? "Confirm" : "OK")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
