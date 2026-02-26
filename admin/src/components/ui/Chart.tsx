import * as React from "react";
import { cn } from "../../lib/utils";

interface BarChartData {
    label: string;
    value: number;
    color?: string;
}

interface BarChartProps {
    data: BarChartData[];
    maxValue?: number;
    className?: string;
    showLabels?: boolean;
    showValues?: boolean;
}

function BarChart({ data, maxValue, className, showLabels = true, showValues = true }: BarChartProps) {
    const max = maxValue ?? Math.max(...data.map((d) => d.value));

    return (
        <div className={cn("space-y-4", className)}>
            {data.map((item, index) => (
                <div key={index} className="space-y-2">
                    {showLabels && (
                        <div className="flex items-center justify-between text-sm">
                            <span style={{ color: 'var(--text-secondary)' }} className="font-medium">{item.label}</span>
                            {showValues && (
                                <span style={{ color: 'var(--text-primary)' }} className="font-semibold">
                                    ₹{item.value.toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${max > 0 ? (item.value / max) * 100 : 0}%`,
                                background: item.color ?? 'var(--accent)'
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

interface LineChartData {
    label: string;
    value: number;
}

interface LineChartProps {
    data: LineChartData[];
    className?: string;
    height?: number;
    color?: string;
}

function LineChart({ data, className, height = 200, color = "#E6A23C" }: LineChartProps) {
    const max = Math.max(...data.map((d) => d.value));
    const min = Math.min(...data.map((d) => d.value));
    const range = max - min || 1;

    const points = data.map((d, i) => ({
        x: (i / (data.length - 1 || 1)) * 100,
        y: 100 - ((d.value - min) / range) * 75 - 12,
    }));

    const pathD = points.length > 0
        ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
        : "";

    const areaD = pathD + ` L ${points[points.length - 1]?.x ?? 0} 100 L ${points[0]?.x ?? 0} 100 Z`;

    return (
        <div className={cn("relative", className)} style={{ height }}>
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                {[20, 40, 60, 80].map((y) => (
                    <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="100"
                        y2={y}
                        stroke="var(--border)"
                        strokeWidth="0.3"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
                {/* Area fill */}
                <path d={areaD} fill={`url(#lineGradient-${color.replace('#', '')})`} opacity="0.15" />
                {/* Line */}
                <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
                {/* Points */}
                {points.map((p, i) => (
                    <g key={i}>
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill="var(--bg-secondary)"
                            stroke={color}
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                        />
                    </g>
                ))}
                <defs>
                    <linearGradient id={`lineGradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
            {/* X-axis labels */}
            <div
                className="absolute bottom-0 left-0 right-0 flex justify-between text-xs transform translate-y-6"
                style={{ color: 'var(--text-muted)' }}
            >
                {data.map((d, i) => (
                    <span key={i} className="text-center">{d.label}</span>
                ))}
            </div>
        </div>
    );
}

interface DonutChartData {
    label: string;
    value: number;
    color: string;
}

interface DonutChartProps {
    data: DonutChartData[];
    size?: number;
    thickness?: number;
    className?: string;
    centerLabel?: React.ReactNode;
}

function DonutChart({ data, size = 160, thickness = 20, className, centerLabel }: DonutChartProps) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;

    let offset = 0;
    const segments = data.map((d) => {
        const length = total > 0 ? (d.value / total) * circumference : 0;
        const segment = { ...d, offset, length };
        offset += length;
        return segment;
    });

    return (
        <div className={cn("flex flex-col items-center gap-4", className)}>
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="var(--bg-tertiary)"
                        strokeWidth={thickness}
                    />
                    {/* Segments */}
                    {segments.map((segment, i) => (
                        <circle
                            key={i}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth={thickness}
                            strokeDasharray={`${segment.length} ${circumference}`}
                            strokeDashoffset={-segment.offset}
                            strokeLinecap="round"
                            className="transition-all duration-700"
                            style={{ filter: 'drop-shadow(0 0 6px ' + segment.color + '40)' }}
                        />
                    ))}
                </svg>
                {centerLabel ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {centerLabel}
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                            {total}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</span>
                    </div>
                )}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: item.color, boxShadow: `0 0 6px ${item.color}60` }}
                        />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {item.label} ({item.value})
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export { BarChart, LineChart, DonutChart };
export type { BarChartData, LineChartData, DonutChartData };
