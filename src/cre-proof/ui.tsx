import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { Column, Row } from "./types";

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const Section: React.FC<SectionProps> = ({
  icon,
  title,
  subtitle,
  accentColor,
  badge,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden shrink-0 sci-card">
      <button
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left cursor-pointer"
        style={{
          borderBottom: open ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{ background: `${accentColor}15` }}
          >
            <span style={{ color: accentColor }}>{icon}</span>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#ffffff" }}>
              {title}
            </p>
            <p className="text-xs" style={{ color: "#d0d0d0" }}>
              {subtitle}
            </p>
          </div>
          {badge && <div className="ml-3">{badge}</div>}
        </div>
        <span style={{ color: "#d0d0d0" }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && <div className="px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
};

export const Loader = ({ color }: { color: string }) => (
  <div className="flex items-center justify-center py-10">
    <RefreshCw size={24} className="animate-spin" style={{ color }} />
    <span className="ml-2 text-sm" style={{ color: "#d0d0d0" }}>
      Loading…
    </span>
  </div>
);

export const Empty = () => (
  <p className="py-8 text-center text-sm" style={{ color: "#d0d0d0" }}>
    No events found for this period.
  </p>
);

export const DataTable: React.FC<{
  columns: Column[];
  rows: Row[];
  accentColor: string;
}> = ({ columns, rows, accentColor }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse min-w-[600px] text-xs">
      <thead>
        <tr
          className="border-b text-[10px] uppercase tracking-widest font-bold"
          style={{ borderColor: `${accentColor}22`, color: "#d0d0d0" }}
        >
          {columns.map((column) => (
            <th
              key={column.key}
              className="py-3 pr-5 font-semibold whitespace-nowrap"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={index}
            className="border-b transition-colors"
            style={{ borderColor: `${accentColor}12` }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = `${accentColor}08`;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            {columns.map((column) => (
              <td
                key={column.key}
                className="py-3 pr-5 text-white font-mono whitespace-nowrap"
              >
                {column.render ?
                  column.render(row)
                :
                  String(row[column.key] ?? "-")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const StatChip: React.FC<{
  label: string;
  value: React.ReactNode;
  color: string;
}> = ({ label, value, color }) => (
  <div className="px-5 py-4 flex flex-col gap-1 sci-card group">
    <span
      className="text-[10px] uppercase tracking-widest"
      style={{ color: "#d0d0d0" }}
    >
      {label}
    </span>
    <span className="text-sm font-bold font-mono" style={{ color }}>
      {value}
    </span>
  </div>
);

export const PassBadge: React.FC<{ passed?: boolean }> = ({ passed }) => {
  if (passed == null) return <span style={{ color: "#d0d0d0" }}>-</span>;

  return passed ? (
    <span className="flex items-center gap-1 text-[#45ab84] font-bold">
      <CheckCircle2 size={13} /> PASS
    </span>
  ) : (
    <span className="flex items-center gap-1 text-red-400 font-bold">
      <XCircle size={13} /> FAIL
    </span>
  );
};
