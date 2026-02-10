import React from 'react';
import { AIAnalysisResult } from '../services/aiService';

interface AIAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysis: AIAnalysisResult | null;
    isLoading: boolean;
    title: string;
}

export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({ isOpen, onClose, analysis, isLoading, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-900/30 p-2 rounded-lg border border-purple-500/30">
                            <span className="text-2xl">✨</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Analista Virtual</h3>
                            <p className="text-sm text-purple-400">Análisis inteligente para: {title}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs text-purple-400 font-bold">IA</span>
                                </div>
                            </div>
                            <p className="text-slate-300 animate-pulse text-center">Analizando indicadores y detectando brechas...</p>
                        </div>
                    ) : analysis ? (
                        <div className="space-y-8 animate-fadeIn">
                            {/* Summary */}
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                <p className="text-slate-300 text-sm leading-relaxed">{analysis.summary}</p>
                            </div>

                            <div className="grid gap-6">
                                {/* Forecast (v3.9.0) */}
                                {analysis.forecast && (
                                    <div className="bg-indigo-900/20 border border-indigo-500/30 p-5 rounded-2xl animate-in zoom-in-95 duration-500">
                                        <h4 className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">
                                            <span className="text-xl">🔮</span> Predicción de Cierre
                                        </h4>
                                        <p className="text-indigo-100 text-sm font-medium leading-relaxed italic">{analysis.forecast}</p>
                                    </div>
                                )}

                                {/* Alerts */}
                                {analysis.alerts.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-red-400 uppercase tracking-wider">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            Riesgos Detectados
                                        </h4>
                                        <ul className="space-y-2">
                                            {analysis.alerts.map((alert, i) => (
                                                <li key={i} className="bg-red-900/10 border border-red-900/30 p-3 rounded-xl text-red-200 text-sm flex gap-3 items-start">
                                                    <span className="text-red-500 mt-0.5">•</span>
                                                    <span>{alert}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Critical Notes Summary (v3.9.0) */}
                                {analysis.criticalNotesSumary && (
                                    <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 border-l-cyan-500 border-l-4">
                                        <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1">Métricas Cualitativas</h4>
                                        <p className="text-slate-400 text-xs italic">{analysis.criticalNotesSumary}</p>
                                    </div>
                                )}

                                {/* Strengths */}
                                {analysis.strengths.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-green-400 uppercase tracking-wider">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Pilares de Desempeño
                                        </h4>
                                        <ul className="space-y-2">
                                            {analysis.strengths.map((strength, i) => (
                                                <li key={i} className="bg-green-900/10 border border-green-900/30 p-3 rounded-xl text-green-200 text-sm flex gap-3 items-start">
                                                    <span className="text-green-500 mt-0.5">•</span>
                                                    <span>{strength}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Recommendations */}
                                {analysis.recommendations.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                            Estrategia de Mitigación
                                        </h4>
                                        <div className="bg-blue-900/10 border border-blue-900/30 rounded-xl overflow-hidden divide-y divide-blue-800/30">
                                            {analysis.recommendations.map((rec, i) => (
                                                <div key={i} className="p-4 text-blue-200 text-sm flex gap-3 items-start hover:bg-blue-500/5 transition-colors">
                                                    <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5">{i + 1}</span>
                                                    <span>{rec}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    ) : (
                        <div className="text-center text-slate-500">No se pudo generar el análisis.</div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
