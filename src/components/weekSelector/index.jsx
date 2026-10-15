import { useState, useEffect } from "react";
import { weeksOfYear, weekYear } from "./weeks.mjs";
export default function WeekSelector({
  value,
  onChange,
  className,
  allowAll = false,
  labelPrefix = "Reporting",
}) {
  const [year, setYear] = useState(() =>
    weekYear(value || new Date().toISOString().slice(0, 10))
  );
  useEffect(() => {
    if (value) setYear(weekYear(value));
  }, [value]);
  const weeks = weeksOfYear(year),
    selected = weeks.find((w) => w.value === value)?.number || 1;
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        Year
        <select
          aria-label={`${labelPrefix} year`}
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
            if (allowAll && !value) return;
            const options = weeksOfYear(Number(e.target.value));
            onChange(options[Math.min(selected, options.length) - 1].value);
          }}
          className={className}
        >
          {Array.from({ length: 131 }, (_, i) => 1970 + i).map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        Week
        <select
          aria-label={`${labelPrefix} week`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className + " max-w-full"}
        >
          {allowAll && <option value="">All weeks</option>}
          {weeks.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
