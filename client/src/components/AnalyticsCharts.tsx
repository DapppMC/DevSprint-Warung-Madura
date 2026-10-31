import { useState } from 'react';

// Status colors standard
export const STATUS_COLORS = {
  OPEN: '#3b82f6', // Blue
  PARTIAL: '#f59e0b', // Amber
  COMPLETE: '#10b981', // Emerald
  CANCELLED: '#f43f5e', // Rose
  STOCK_IN: '#10b981', // Emerald
  STOCK_OUT: '#3b82f6', // Blue
  ADJUSTMENT: '#8b5cf6', // Violet
};

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  subtitle?: string;
  data: DonutSegment[];
  centerLabel?: string;
}

export function DonutChart({ title, subtitle, data, centerLabel = 'Total' }: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = data.reduce((acc, d) => acc + d.value, 0);

  // SVG calculations for donut
  const size = 200;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-auto py-2">
        <div className="relative w-48 h-48 shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
              strokeWidth={strokeWidth}
            />
            {total > 0 &&
              data.map((item, idx) => {
                if (item.value <= 0) return null;
                const percentage = item.value / total;
                const strokeDasharray = `${percentage * circumference} ${circumference}`;
                const strokeDashoffset = -accumulatedPercentage * circumference;
                accumulatedPercentage += percentage;

                const isHovered = hoveredIdx === idx;

                return (
                  <circle
                    key={item.id}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-transform duration-100 ease-out duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
          </svg>

          {/* Center metric */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {hoveredIdx !== null ? data[hoveredIdx].label : centerLabel}
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
              {hoveredIdx !== null ? data[hoveredIdx].value : total}
            </span>
            {hoveredIdx !== null && total > 0 && (
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {Math.round((data[hoveredIdx].value / total) * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="w-full sm:w-auto flex flex-col gap-2">
          {data.map((item, idx) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-transform duration-100 ease-out ${
                  isHovered
                    ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 shadow-xs scale-102'
                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50/70 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{item.value}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface BarDataPoint {
  label: string;
  inflow: number; // Barang Masuk
  outflow: number; // Penjualan
}

interface BarChartProps {
  title: string;
  subtitle?: string;
  data: BarDataPoint[];
}

export function BarChart({ title, subtitle, data }: BarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    ...data.flatMap((d) => [d.inflow, d.outflow]),
    10,
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Barang Masuk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Penjualan</span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col justify-end pt-6 pb-2 min-h-[180px]">
        {/* Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-end pr-1">
            {maxVal}
          </div>
          <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full flex justify-end pr-1">
            {Math.round(maxVal / 2)}
          </div>
          <div className="border-b border-slate-200 dark:border-slate-800 w-full flex justify-end pr-1">0</div>
        </div>

        {/* Bars Container */}
        <div className="relative z-10 flex items-end justify-between gap-2 px-4 h-36">
          {data.map((item, idx) => {
            const inflowH = (item.inflow / maxVal) * 100;
            const outflowH = (item.outflow / maxVal) * 100;
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={item.label}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-3 z-30 transform -translate-y-full bg-slate-900 dark:bg-slate-800 border border-transparent dark:border-slate-700 text-white rounded-lg p-2 text-[11px] shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in duration-100">
                    <p className="font-bold border-b border-slate-700 dark:border-slate-600 pb-1 mb-1">{item.label}</p>
                    <p className="text-emerald-400">Masuk: {item.inflow} unit</p>
                    <p className="text-blue-400">Terjual: {item.outflow} unit</p>
                  </div>
                )}

                <div className="w-full flex items-end justify-center gap-1 h-full pb-1">
                  {/* Inflow Bar */}
                  <div
                    className="w-1/2 max-w-[18px] bg-emerald-600 hover:bg-emerald-500 rounded-t-sm transition-transform duration-100 ease-out duration-300"
                    style={{ height: `${Math.max(inflowH, 4)}%` }}
                    title={`Masuk: ${item.inflow}`}
                  />
                  {/* Outflow Bar */}
                  <div
                    className="w-1/2 max-w-[18px] bg-blue-600 hover:bg-blue-500 rounded-t-sm transition-transform duration-100 ease-out duration-300"
                    style={{ height: `${Math.max(outflowH, 4)}%` }}
                    title={`Keluar: ${item.outflow}`}
                  />
                </div>

                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-transform duration-100 ease-out mt-1">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
