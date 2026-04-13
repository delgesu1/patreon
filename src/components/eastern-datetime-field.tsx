"use client";

import { useId } from "react";
import { normalizeEasternDateTimeLocalValue } from "@/lib/eastern-time";

type EasternDateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  compact?: boolean;
  required?: boolean;
};

export function EasternDateTimeField({
  label,
  value,
  onChange,
  helperText = "Eastern Time only. Whole-hour selections only.",
  compact = false,
  required = false,
}: EasternDateTimeFieldProps) {
  const id = useId();
  const helpId = `${id}-help`;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <label
        htmlFor={id}
        className={`block ${
          compact ? "text-[11px]" : "text-xs"
        } font-semibold uppercase tracking-[0.2em] text-slate-500`}
      >
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5">
        <input
          id={id}
          type="datetime-local"
          step={3600}
          required={required}
          value={value}
          onChange={(e) => onChange(normalizeEasternDateTimeLocalValue(e.target.value))}
          aria-describedby={helpId}
          className={`min-w-0 flex-1 bg-transparent outline-none [color-scheme:light] ${
            compact ? "py-0.5 text-sm" : "py-1 text-sm"
          } text-slate-900 placeholder:text-slate-400`}
        />
        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          ET
        </span>
      </div>
      <p
        id={helpId}
        className={`text-xs text-slate-500 ${compact ? "leading-snug" : ""}`}
      >
        {helperText}
      </p>
    </div>
  );
}
