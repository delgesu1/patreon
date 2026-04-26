"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type EasternDateTimeFieldProps = {
  label: string;
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  helperText?: string;
  compact?: boolean;
  required?: boolean;
};

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseValue(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
  };
}

function buildValue(year: number, month: number, day: number, hour: number) {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:00`;
}

function formatDisplay(value: string) {
  const p = parseValue(value);
  if (!p) return null;
  const date = new Date(p.year, p.month - 1, p.day);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthName = date.toLocaleDateString("en-US", { month: "short" });
  return `${weekday}, ${monthName} ${p.day} at ${formatHour(p.hour)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function firstDayOfWeek(year: number, month: number) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

export function EasternDateTimeField({
  label,
  value,
  onChange,
  compact = false,
  required = false,
}: EasternDateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  // Parse existing value for initial calendar view
  const parsed = parseValue(value);
  const now = new Date();

  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1);

  const [selectedDay, setSelectedDay] = useState<{ year: number; month: number; day: number } | null>(
    parsed ? { year: parsed.year, month: parsed.month, day: parsed.day } : null
  );
  const [selectedHour, setSelectedHour] = useState<number | null>(parsed?.hour ?? null);

  function calculatePopupStyle() {
    const trigger = triggerRef.current;
    if (!trigger) return null;

    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(Math.max(rect.width, 320), viewportWidth - margin * 2);
    const left = Math.min(Math.max(margin, rect.left), viewportWidth - width - margin);
    const spaceBelow = viewportHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openAbove = spaceBelow < 360 && spaceAbove > spaceBelow;

    if (openAbove) {
      return {
        left,
        width,
        bottom: Math.max(margin, viewportHeight - rect.top + gap),
        maxHeight: Math.max(0, spaceAbove),
      };
    }

    return {
      left,
      width,
      top: rect.bottom + gap,
      maxHeight: Math.max(0, spaceBelow),
    };
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    function updatePopupStyle() {
      setPopupStyle(calculatePopupStyle());
    }

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePopupStyle);
    window.addEventListener("scroll", updatePopupStyle, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePopupStyle);
      window.removeEventListener("scroll", updatePopupStyle, true);
    };
  }, [open]);

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function commitSelection(
    nextDay: { year: number; month: number; day: number } | null,
    nextHour: number | null
  ) {
    if (!nextDay || nextHour === null) return;
    onChange(buildValue(nextDay.year, nextDay.month, nextDay.day, nextHour));
    setOpen(false);
  }

  function initializePickerState() {
    const nextParsed = parseValue(value);
    const nextNow = new Date();

    if (nextParsed) {
      setViewYear(nextParsed.year);
      setViewMonth(nextParsed.month);
      setSelectedDay({
        year: nextParsed.year,
        month: nextParsed.month,
        day: nextParsed.day,
      });
      setSelectedHour(nextParsed.hour);
      return;
    }

    setViewYear(nextNow.getFullYear());
    setViewMonth(nextNow.getMonth() + 1);
    setSelectedDay(null);
    setSelectedHour(null);
  }

  function handleDayClick(day: number) {
    const newDay = { year: viewYear, month: viewMonth, day };
    setSelectedDay(newDay);
    commitSelection(newDay, selectedHour);
  }

  function handleHourClick(hour: number) {
    setSelectedHour(hour);
    commitSelection(selectedDay, hour);
  }

  const display = formatDisplay(value);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfWeek(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <label
        className={`block ${
          compact ? "text-[11px]" : "text-xs"
        } font-semibold uppercase tracking-[0.2em] text-stone-500`}
      >
        {label}
        {required && <span className="ml-1 text-stone-400">*</span>}
      </label>

      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          initializePickerState();
          setPopupStyle(calculatePopupStyle());
          setOpen(true);
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-200 hover:border-stone-300 ${
          compact ? "px-3 py-2" : "px-3 py-2.5"
        } ${open ? "border-amber-500 ring-2 ring-amber-500/20" : ""}`}
      >
        <span className={`text-sm ${display ? "text-stone-900" : "text-stone-400"}`}>
          {display ?? "Select date & time"}
        </span>
        <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
          ET
        </span>
      </button>

      {open && popupStyle && createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998] bg-transparent"
              onMouseDown={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="false"
              className="fixed z-[9999] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl ring-1 ring-stone-900/5"
              style={popupStyle}
            >
              {/* Calendar */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100"
                  >
                    &lsaquo;
                  </button>
                  <span className="text-sm font-semibold text-stone-800">{monthLabel}</span>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100"
                  >
                    &rsaquo;
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {DAYS.map((d) => (
                    <div
                      key={d}
                      className="py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400"
                    >
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const day = i + 1;
                    const isToday =
                      viewYear === todayYear && viewMonth === todayMonth && day === todayDay;
                    const isSelected =
                      selectedDay &&
                      selectedDay.year === viewYear &&
                      selectedDay.month === viewMonth &&
                      selectedDay.day === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={`rounded-lg py-1.5 text-sm transition ${
                          isSelected
                            ? "bg-amber-600 font-semibold text-white"
                            : isToday
                            ? "bg-stone-100 font-semibold text-stone-900"
                            : "text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="mb-3 border-t border-stone-100" />

              {/* Hour grid */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  Hour
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourClick(h)}
                      className={`rounded-lg px-1 py-1.5 text-xs transition ${
                        selectedHour === h
                          ? "bg-amber-600 font-semibold text-white"
                          : "text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {formatHour(h)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
