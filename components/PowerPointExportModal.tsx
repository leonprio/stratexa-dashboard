import React, { useState } from 'react';
import { Dashboard, ComplianceThresholds } from '../types';
import { PowerPointExportConfig, DEFAULT_PPTX_CONFIG, exportToPowerPoint } from '../utils/powerPointExport';

interface PowerPointExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    dashboards: Dashboard[];
    globalThresholds: ComplianceThresholds;
    year?: number;
    title?: string;
}

export const PowerPointExportModal: React.FC<PowerPointExportModalProps> = ({
    isOpen,
    onClose,
    dashboards,
    globalThresholds,
    year,
    title = 'Dashboard Ejecutivo'
}) => {
    const [config, setConfig] = useState<PowerPointExportConfig>(DEFAULT_PPTX_CONFIG);
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setExportError(null);

        try {
            await exportToPowerPoint(dashboards, globalThresholds, config, year, title);
            // Cerrar modal después de 1 segundo para que el usuario vea que se completó
            setTimeout(() => {
                onClose();
                setIsExporting(false);
            }, 1000);
        } catch (error) {
            console.error('Error al exportar PowerPoint:', error);
            setExportError('Error al generar el archivo PowerPoint. Por favor, intenta nuevamente.');
            setIsExporting(false);
        }
    };

    const toggleOption = (key: keyof PowerPointExportConfig) => {
        if (key === 'theme') return; // El tema se maneja por separado
        setConfig(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const setTheme = (theme: 'dark' | 'light' | 'corporate') => {
        setConfig(prev => ({ ...prev, theme }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden border border-white/10">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <div>
                                <h2 className="text-2xl font-black text-white">Exportar PowerPoint</h2>
                                <p className="text-sm text-orange-100">Configura el contenido de tu presentación</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white transition-colors p-2"
                            disabled={isExporting}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Tema */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                            🎨 Tema de Presentación
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setTheme('dark')}
                                className={`p-4 rounded-xl border-2 transition-all ${config.theme === 'dark'
                                    ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                                    : 'border-white/10 bg-slate-800/50 hover:border-white/20'
                                    }`}
                            >
                                <div className="w-full h-16 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 mb-2 border border-white/10"></div>
                                <p className="text-xs font-bold text-white text-center">Oscuro</p>
                                <p className="text-[10px] text-slate-400 text-center">Moderno</p>
                            </button>

                            <button
                                onClick={() => setTheme('light')}
                                className={`p-4 rounded-xl border-2 transition-all ${config.theme === 'light'
                                    ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                                    : 'border-white/10 bg-slate-800/50 hover:border-white/20'
                                    }`}
                            >
                                <div className="w-full h-16 rounded-lg bg-gradient-to-br from-white to-slate-100 mb-2 border border-slate-300"></div>
                                <p className="text-xs font-bold text-white text-center">Claro</p>
                                <p className="text-[10px] text-slate-400 text-center">Profesional</p>
                            </button>

                            <button
                                onClick={() => setTheme('corporate')}
                                className={`p-4 rounded-xl border-2 transition-all ${config.theme === 'corporate'
                                    ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                                    : 'border-white/10 bg-slate-800/50 hover:border-white/20'
                                    }`}
                            >
                                <div className="w-full h-16 rounded-lg bg-gradient-to-br from-[#1A1A2E] to-[#16213E] mb-2 border border-[#0F4C75]"></div>
                                <p className="text-xs font-bold text-white text-center">Corporativo</p>
                                <p className="text-[10px] text-slate-400 text-center">Elegante</p>
                            </button>
                        </div>
                    </div>

                    {/* Opciones de Contenido */}
                    <div>
                        <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                            📄 Contenido a Incluir
                        </label>
                        <div className="space-y-3">
                            <ToggleOption
                                label="Resumen Ejecutivo"
                                description="Insights automáticos, recomendaciones y análisis general"
                                icon="📊"
                                checked={config.includeExecutiveSummary}
                                onChange={() => toggleOption('includeExecutiveSummary')}
                            />

                            <ToggleOption
                                label="Gráficos de Tendencia"
                                description="Gráficas de líneas mostrando evolución mensual"
                                icon="📈"
                                checked={config.includeTrendAnalysis}
                                onChange={() => toggleOption('includeTrendAnalysis')}
                            />

                            <ToggleOption
                                label="Ranking con Semáforos"
                                description="Tabla de posiciones con indicadores visuales de estado"
                                icon="🚦"
                                checked={config.includeRanking}
                                onChange={() => toggleOption('includeRanking')}
                            />

                            <ToggleOption
                                label="Semáforos de Estado"
                                description="Indicadores de color en todas las visualizaciones"
                                icon="🔴🟡🟢"
                                checked={config.includeTrafficLights}
                                onChange={() => toggleOption('includeTrafficLights')}
                            />

                            <ToggleOption
                                label="Slides Detallados"
                                description="Una slide por cada tablero/unidad con todos sus indicadores"
                                icon="📑"
                                checked={config.includeDetailedSlides}
                                onChange={() => toggleOption('includeDetailedSlides')}
                            />

                            <ToggleOption
                                label="Planes de Acción"
                                description="Incluir protocolos de acción para indicadores en riesgo"
                                icon="⚡"
                                checked={config.includeActionPlans}
                                onChange={() => toggleOption('includeActionPlans')}
                            />
                        </div>
                    </div>

                    {/* Preview Info */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm font-bold text-white mb-1">Vista Previa de Exportación</p>
                                <p className="text-xs text-slate-400">
                                    Se generarán aproximadamente {estimateSlideCount(config, dashboards.length)} slides
                                    {config.includeExecutiveSummary && ' con análisis ejecutivo automático'}
                                    {config.includeTrendAnalysis && ', gráficos de tendencia'}
                                    {config.includeRanking && ' y ranking completo'}
                                    .
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {exportError && (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-rose-300">{exportError}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-800/50 px-8 py-5 border-t border-white/5 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        disabled={isExporting}
                        className="px-6 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>

                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isExporting ? (
                            <>
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generando...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Exportar PowerPoint
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Componente auxiliar para opciones toggle
interface ToggleOptionProps {
    label: string;
    description: string;
    icon: string;
    checked: boolean;
    onChange: () => void;
}

const ToggleOption: React.FC<ToggleOptionProps> = ({ label, description, icon, checked, onChange }) => {
    return (
        <button
            onClick={onChange}
            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${checked
                ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                : 'border-white/10 bg-slate-800/30 hover:border-white/20 hover:bg-slate-800/50'
                }`}
        >
            <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold text-white">{label}</h4>
                        <div className={`w-12 h-6 rounded-full transition-all relative ${checked ? 'bg-cyan-500' : 'bg-slate-600'
                            }`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? 'left-6.5' : 'left-0.5'
                                }`}></div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">{description}</p>
                </div>
            </div>
        </button>
    );
};

// Función auxiliar para estimar número de slides
function estimateSlideCount(config: PowerPointExportConfig, dashboardCount: number): number {
    let count = 1; // Portada

    if (config.includeExecutiveSummary) count += 1;
    if (config.includeRanking) count += 1;
    if (config.includeTrendAnalysis) count += 1;
    if (config.includeDetailedSlides) count += dashboardCount;

    return count;
}
