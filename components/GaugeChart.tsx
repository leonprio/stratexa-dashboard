import React from 'react';

interface GaugeChartProps {
    value: number;
    label: string;
    status: 'OnTrack' | 'AtRisk' | 'OffTrack' | 'Neutral' | 'InProgress';
    size?: number;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({ value, label, status, size = 200 }) => {
    const radius = 80;
    const strokeWidth = 12;
    const normalizedValue = Math.min(100, Math.max(0, value));
    const circumference = radius * Math.PI; // Half circle
    const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

    const colorMap = {
        OnTrack: '#10b981', // emerald-500
        AtRisk: '#f59e0b',  // amber-500
        OffTrack: '#f43f5e', // rose-500
        Neutral: '#64748b',  // slate-500
        InProgress: '#0ea5e9', // sky-500
    };

    const glowMap = {
        OnTrack: 'rgba(16, 185, 129, 0.4)',
        AtRisk: 'rgba(245, 158, 11, 0.4)',
        OffTrack: 'rgba(244, 63, 94, 0.4)',
        Neutral: 'rgba(100, 116, 139, 0.4)',
        InProgress: 'rgba(14, 165, 233, 0.4)',
    };

    const color = colorMap[status];
    const glow = glowMap[status];

    return (
        <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size / 1.5 }}>
            <svg width={size} height={size / 1.5} viewBox="0 0 200 130">
                {/* Background Track */}
                <path
                    d="M 20 110 A 80 80 0 0 1 180 110"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                {/* Progress Value */}
                <path
                    d="M 20 110 A 80 80 0 0 1 180 110"
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                        transition: 'stroke-dashoffset 1.5s cubic-bezier(0.23, 1, 0.32, 1)',
                        filter: `drop-shadow(0 0 8px ${glow})`
                    }}
                />

                {/* Value Text */}
                <text x="100" y="95" textAnchor="middle" className="fill-white font-black text-3xl tabular-nums">
                    {Math.round(value)}%
                </text>
                <text x="100" y="120" textAnchor="middle" className="fill-slate-500 font-extrabold text-[10px] uppercase tracking-[0.2em]">
                    {label}
                </text>
            </svg>

            {/* Decorative Needle or Indicator dots could go here */}
        </div>
    );
};
