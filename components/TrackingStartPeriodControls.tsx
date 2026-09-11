import React from 'react';
import type { TrackingStartPeriod } from '../types';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const formatTrackingStartPeriod = (period?: TrackingStartPeriod): string => !period ? 'Inicio de seguimiento sin configurar' : period.frequency === 'monthly' ? `${MONTHS[period.monthIndex]} ${period.year}` : `Semana ${period.weekNumber} · ${period.year}`;

export const TrackingStartPeriodControls: React.FC<{
  value?: TrackingStartPeriod;
  frequency: 'monthly' | 'weekly';
  year: number;
  onChange: (value: TrackingStartPeriod) => void;
}> = ({ value, frequency, year, onChange }) => {
  const selectedYear = value?.year ?? year;
  const index = value?.frequency === frequency ? (frequency === 'monthly' ? value.monthIndex : value.weekNumber - 1) : 0;
  const update = (nextYear: number, nextIndex: number) => onChange(frequency === 'monthly'
    ? { frequency, year: nextYear, monthIndex: nextIndex }
    : { frequency, year: nextYear, weekNumber: nextIndex + 1 });
  return <div className="grid grid-cols-2 gap-2">
    <select aria-label="Año de inicio de seguimiento" value={selectedYear} onChange={e => update(Number(e.target.value), index)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white">
      {[year - 1, year, year + 1].map(option => <option key={option} value={option}>{option}</option>)}
    </select>
    <select aria-label={frequency === 'monthly' ? 'Mes de inicio de seguimiento' : 'Semana de inicio de seguimiento'} value={index} onChange={e => update(selectedYear, Number(e.target.value))} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white">
      {frequency === 'monthly' ? MONTHS.map((month, i) => <option key={month} value={i}>{month}</option>) : Array.from({ length: 53 }, (_, i) => <option key={i} value={i}>Semana {i + 1}</option>)}
    </select>
  </div>;
};
