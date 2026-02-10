import React from 'react';

interface HelpCenterProps {
    userRole: 'Admin' | 'Director' | 'Member' | string;
    onClose: () => void;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ userRole, onClose }) => {
    const roleKey = userRole.toLowerCase();
    const isAdmin = roleKey === 'admin';

    return (
        <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] shadow-3xl overflow-hidden flex flex-col ring-1 ring-white/5">

                {/* Header Simplificado (v3.2.5) */}
                <div className="p-10 border-b border-white/5 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/10">📘</div>
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-2xl">Manual de Vuelo</h2>
                        </div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.4em] opacity-50 ml-1">
                            {isAdmin ? 'Módulo de Gestión Centralizada' : 'Guía de Inteligencia de Negocios'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="relative z-10 w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all group border border-white/5"
                    >
                        <span className="text-xl group-hover:rotate-90 transition-transform duration-300">✕</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
                    <div className="max-w-3xl mx-auto">
                        {isAdmin && <AdminGuide />}
                        {roleKey === 'director' && <DirectorGuide />}
                        {(roleKey === 'member' || (!['admin', 'director'].includes(roleKey))) && <MemberGuide />}

                        {/* Sección de Ayuda Adicional (Nueva) */}
                        <div className="mt-16 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-slate-950/40 rounded-[2rem] border border-white/5">
                                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">🆘 Soporte Prior</h5>
                                <p className="text-xs text-slate-400 leading-relaxed italic">Para asistencia técnica directa o reportes, contacta al administrador de tu sistema.</p>
                            </div>
                            <div className="p-6 bg-slate-950/40 rounded-[2rem] border border-white/5">
                                <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">🔄 Sincronización</h5>
                                <p className="text-xs text-slate-400 leading-relaxed italic">Los datos se guardan al instante. Si notas una discrepancia, usa el botón refrescar del navegador.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer sin versión para mayor limpieza */}
                <div className="p-6 bg-black/40 border-t border-white/5 text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                        <span>✨</span> Potenciado por Inteligencia Artificial para el Cumplimiento Operativo <span>✨</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

const Step = ({ num, title, desc, children }: any) => (
    <div className="flex gap-8 mb-14 last:mb-0 group">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/10 flex-shrink-0 flex items-center justify-center text-sm font-black text-indigo-400 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all shadow-2xl relative">
            <div className="absolute -inset-1 bg-indigo-500/10 blur opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
            <span className="relative z-10">{num}</span>
        </div>
        <div className="flex-1">
            <h4 className="text-base font-black text-white uppercase tracking-wider mb-3 group-hover:text-indigo-300 transition-colors">{title}</h4>
            <div className="text-[13px] text-slate-400 leading-relaxed space-y-4">
                {typeof desc === 'string' ? <p>{desc}</p> : desc}
                {children}
            </div>
        </div>
    </div>
);

const MemberGuide = () => (
    <div className="animate-in slide-in-from-bottom duration-700">
        <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4">
            🚀 Guía de <span className="text-indigo-400 italic">Usuario</span>
        </h3>

        <Step num="01" title="Navegación Táctica" desc="La cinta superior es tu centro de mando. Filtra por grupo o selecciona un tablero específico para visualizar sus indicadores críticos. El punto de color te muestra el estado de salud en tiempo real." />

        <Step num="02" title="Gestión de 3 Celdas" desc="Al gestionar un periodo (Semana o Mes), el sistema te presenta tres celdas clave para la toma de decisiones:">
            <div className="grid grid-cols-1 gap-3 mt-4">
                <div className="p-4 bg-slate-800/60 border border-white/5 rounded-2xl shadow-inner">
                    <div className="text-[11px] font-black text-white uppercase mb-1">🏁 La Meta</div>
                    <p className="text-[11px] text-slate-500 italic">El objetivo numérico que define el éxito del periodo.</p>
                </div>
                <div className="p-4 bg-slate-800/60 border border-white/5 rounded-2xl shadow-inner">
                    <div className="text-[11px] font-black text-emerald-400 uppercase mb-1">📈 Avance Real</div>
                    <p className="text-[11px] text-slate-500 italic">El resultado obtenido. Se compara dinámicamente vs la meta.</p>
                </div>
                <div className="p-4 bg-slate-800/60 border border-white/5 rounded-2xl shadow-inner">
                    <div className="text-[11px] font-black text-indigo-400 uppercase mb-1">📝 Info Relevante</div>
                    <p className="text-[11px] text-slate-500 italic">Espacio para diagnosticar variaciones y justificar el resultado.</p>
                </div>
            </div>
        </Step>

        <Step num="03" title="Diseño de Estrategia (PAI/PM)" desc="Debajo de cada indicador, diseña tu plan táctico. Define acciones específicas, fechas de cumplimiento y califica el impacto. El sistema cambia el nombre del plan (Mitigación o Acción Inmediata) según la gravedad del semáforo." />

        <Step num="04" title="Audit IA" desc="Si necesitas una perspectiva externa, solicita una Audit IA. El sistema cruzará tus 3 celdas y tu plan táctico para entregarte una recomendación de nivel consultor." />
    </div>
);

const DirectorGuide = () => (
    <div className="animate-in slide-in-from-bottom duration-700">
        <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4">
            ⚖️ Guía del <span className="text-indigo-400 italic">Líder</span>
        </h3>

        <Step num="01" title="Consolidación Automática" desc="No pierdas tiempo sumando. Tus tableros agregados consolidan el desempeño de todas tus unidades en una sola vista regional o grupal." />

        <Step num="02" title="Ponderación Estratégica" desc="Usa el botón 'Modificar Pesos' para equilibrar tu tablero. Dale más peso a las unidades críticas para que el total refleje la prioridad real del negocio." />

        <Step num="03" title="Auditoría de Planes" desc="Tu labor es supervisar que los Usuarios llenen preventivamente sus planes de acción (PM) y reactivamente sus planes de acción inmediata (PAI)." />

        <Step num="04" title="Inteligencia de Grupo" desc="Utiliza la Audit IA en vistas generales para obtener un plan de acción a nivel Directorio, enfocado en corregir desviaciones sistemáticas del grupo." />
    </div>
);

const AdminGuide = () => (
    <div className="animate-in slide-in-from-bottom duration-700">
        <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4">
            🔑 Centro de <span className="text-indigo-400 italic">Administración</span>
        </h3>
        <Step num="01" title="Jerarquía y Seguridad" desc="Define los Líderes de grupo y los Usuarios operativos. Protege la información asignando solo los clientes y tableros necesarios para cada perfil." />
        <Step num="02" title="Gobernanza de Datos" desc="Mantén la estructura limpia en el módulo Configuración. Asegura que cada año fiscal tenga sus indicadores, pesos y metas base correctamente cargados." />
    </div>
);
