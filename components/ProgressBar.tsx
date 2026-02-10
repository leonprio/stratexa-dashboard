import React from 'react';
import { ComplianceStatus } from '../types';

interface ProgressBarProps {
  percentage: number;
  status: ComplianceStatus;
  showLabel?: boolean;
}

export const ProgressBar = ({ percentage, status, showLabel = true }: ProgressBarProps) => {
  const safePercentage = Math.max(0, Math.min(100, percentage));

  const colorClasses: Record<ComplianceStatus, string> = {
    "OnTrack": 'bg-emerald-500',
    "AtRisk": 'bg-amber-500',
    "OffTrack": 'bg-rose-500',
    "Neutral": 'bg-slate-500',
    "InProgress": 'bg-sky-500',
  };

  const glowColors: Record<ComplianceStatus, string> = {
    "OnTrack": 'rgba(16, 185, 129, 0.5)',
    "AtRisk": 'rgba(245, 158, 11, 0.5)',
    "OffTrack": 'rgba(244, 63, 94, 0.5)',
    "Neutral": 'rgba(100, 116, 139, 0.5)',
    "InProgress": 'rgba(14, 165, 233, 0.5)',
  };

  return (
    <div className="w-full flex items-center gap-6">
      <div className="flex-1 bg-slate-950/80 rounded-full h-2.5 p-0.5 shadow-inner border border-white/5 relative overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-[1.5s] ease-[cubic-bezier(0.23,1,0.32,1)] relative ${colorClasses[status]}`}
          style={{
            width: `${safePercentage}%`,
            boxShadow: `0 0 15px ${glowColors[status]}`
          }}
        >
          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      {showLabel && (
        <span className="text-[10px] font-black text-white tabular-nums tracking-widest min-w-[35px] text-right drop-shadow-lg">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};
