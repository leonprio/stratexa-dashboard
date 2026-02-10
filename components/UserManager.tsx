import React, { useState, useMemo } from 'react';
import { User, Dashboard, GlobalUserRole, DashboardRole } from '../types';
import { firebaseService } from '../services/firebaseService';
import { normalizeGroupName } from '../utils/formatters';

// 🛡️ NORMALIZACIÓN COMPARTIDA (v2.2.3)


interface UserRowProps {
    user: User;
    dashboards: Dashboard[];
    isCurrentUser: boolean;
    isGlobalAdmin: boolean;
    onAccessChange: (userId: string, dashboardId: number | string, role: DashboardRole | 'none') => void;
    onRoleChange: (userId: string, role: GlobalUserRole) => void;
    onResetPassword: (email: string) => void;
    onChangePassword: (userId: string, email: string) => void;
    onDelete: (userId: string, email: string) => void;
    onUpdateUser: (updatedUser: User) => void;
    groupLabel?: string;
    availableGroups: string[];
}

const UserRow = ({ user, dashboards, isCurrentUser, isGlobalAdmin, onAccessChange, onRoleChange, onChangePassword, onDelete, onUpdateUser, groupLabel, availableGroups }: UserRowProps) => {
    const safeUser = {
        ...user,
        dashboardAccess: user.dashboardAccess || {},
        subGroups: user.subGroups || []
    };

    // De-duplicación visual de sub-grupos para el renderizado
    const displaySubGroups = useMemo(() => {
        const seen = new Set<string>();
        return (safeUser.subGroups || []).filter(g => {
            const norm = normalizeGroupName(g);
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
        });
    }, [safeUser.subGroups]);

    return (
        <tr className="group hover:bg-slate-900/50 transition-colors">
            {/* COLUMNA INFO USUARIO */}
            <td className="p-4 border-b border-slate-700/50 align-top sticky left-0 bg-slate-800 group-hover:bg-slate-900/50 z-20 shadow-[4px_0_8px_rgba(0,0,0,0.3)] min-w-[280px]">
                <div className="flex flex-col gap-1">
                    <p className="text-slate-100 font-bold truncate text-sm">{safeUser.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{safeUser.email}</p>

                    <div className="mt-2">
                        {isCurrentUser ? (
                            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-500/20">
                                {safeUser.globalRole} (Tú)
                            </span>
                        ) : (
                            <select
                                value={safeUser.globalRole}
                                onChange={(e) => onRoleChange(safeUser.id, e.target.value as GlobalUserRole)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none font-bold"
                            >
                                <option value={GlobalUserRole.Admin}>Super Administrador</option>
                                <option value={GlobalUserRole.Director}>{groupLabel || 'Director'}</option>
                                <option value={GlobalUserRole.Member}>Miembro Operativo</option>
                            </select>
                        )}
                    </div>

                    {/* PERMISOS ADICIONALES */}
                    <div className="mt-3 flex gap-2 flex-wrap">
                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all cursor-pointer ${safeUser.canManageKPIs ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-900/40 border-slate-700 text-slate-500 opacity-60'}`}>
                            <input
                                type="checkbox"
                                checked={!!safeUser.canManageKPIs}
                                disabled={isCurrentUser}
                                onChange={(e) => onUpdateUser({ ...safeUser, canManageKPIs: e.target.checked })}
                                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
                            />
                            <span className="text-[9px] font-black uppercase tracking-tighter">KPIs</span>
                        </label>
                        <label className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all cursor-pointer ${safeUser.canExportPPT ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' : 'bg-slate-900/40 border-slate-700 text-slate-500 opacity-60'}`}>
                            <input
                                type="checkbox"
                                checked={!!safeUser.canExportPPT}
                                disabled={isCurrentUser}
                                onChange={(e) => onUpdateUser({ ...safeUser, canExportPPT: e.target.checked })}
                                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-0"
                            />
                            <span className="text-[9px] font-black uppercase tracking-tighter">PPT</span>
                        </label>
                    </div>

                    {/* GESTIÓN DE JERARQUÍA (DIRECTORES) */}
                    {safeUser.globalRole === GlobalUserRole.Director && (
                        <div className="mt-3 space-y-2">
                            <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Título de Cargo</span>
                                <input
                                    type="text"
                                    value={safeUser.directorTitle || ''}
                                    disabled={isCurrentUser}
                                    onChange={(e) => onUpdateUser({ ...safeUser, directorTitle: e.target.value.trim().toUpperCase() })}
                                    placeholder={`Ej: DIRECTOR SUR`}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-cyan-400 placeholder:text-slate-700 focus:ring-1 focus:ring-cyan-500 outline-none font-bold"
                                />
                            </div>

                            <div className="relative group/subgroups">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Supervisa Grupos</span>
                                    {!isCurrentUser && (
                                        <button
                                            onClick={() => onUpdateUser({ ...safeUser, subGroups: [] })}
                                            className="text-[8px] font-black text-rose-500 uppercase hover:text-rose-400 transition-colors"
                                        >
                                            Limpiar Todo
                                        </button>
                                    )}
                                </div>
                                <button
                                    disabled={isCurrentUser}
                                    className="w-full text-left bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-[9px] text-slate-300 min-h-[30px] flex items-center gap-1.5 flex-wrap overflow-hidden hover:border-cyan-500/50 transition-all font-bold"
                                >
                                    {displaySubGroups.length > 0 ? (
                                        displaySubGroups.map(g => (
                                            <span key={g} className="inline-block bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded text-[8px] font-black border border-cyan-500/30 mr-1 mb-1">{g}</span>
                                        ))
                                    ) : <span className="text-slate-600 italic">Ninguno seleccionado</span>}
                                </button>

                                {!isCurrentUser && (
                                    <div className="hidden group-hover/subgroups:block absolute left-0 bottom-full mb-2 z-[100] w-72 bg-slate-900 border border-slate-600 rounded-xl shadow-3xl p-3 max-h-64 overflow-y-auto ring-1 ring-cyan-500/30">
                                        <p className="text-[10px] font-black text-cyan-500 uppercase mb-3 pb-2 border-b border-white/5">Seleccionar Grupos de Supervisión</p>
                                        <div className="space-y-1">
                                            {availableGroups.length > 0 ? availableGroups.map(g => {
                                                const normG = normalizeGroupName(g);
                                                const isSelected = (safeUser.subGroups || []).some(sg => normalizeGroupName(sg) === normG);
                                                return (
                                                    <label key={g} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-cyan-500/10' : 'hover:bg-white/5'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                const current = safeUser.subGroups || [];
                                                                let newGroups;
                                                                if (e.target.checked) {
                                                                    // 🔥 PREVENT DUPLICATES: Filter out any existing version of the same normalized group before adding
                                                                    const filtered = current.filter(x => normalizeGroupName(x) !== normG);
                                                                    newGroups = [...filtered, g];
                                                                } else {
                                                                    newGroups = current.filter(x => normalizeGroupName(x) !== normG);
                                                                }
                                                                // Final safeguard de-duplication
                                                                const deduplicated = Array.from(new Map<string, string>(newGroups.map(x => [normalizeGroupName(x), x] as [string, string])).values());
                                                                onUpdateUser({ ...safeUser, subGroups: deduplicated });
                                                            }}
                                                            className="w-4 h-4 rounded bg-slate-950 border-slate-600 text-cyan-500 focus:ring-0"
                                                        />
                                                        <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>{g}</span>
                                                    </label>
                                                );
                                            }) : <p className="text-xs text-slate-600 text-center py-4 italic">No hay grupos definidos</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </td>

            {/* COLUMNAS DE DASHBOARDS (ACCESS MATRIX) */}
            {dashboards.map(d => {
                const role = safeUser.dashboardAccess[d.id] || 'none';
                return (
                    <td key={d.id} className="p-3 border-b border-slate-700/50 align-middle text-center min-w-[140px]">
                        {isGlobalAdmin ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Total
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 items-center px-2">
                                <select
                                    value={role}
                                    onChange={(e) => onAccessChange(safeUser.id, d.id, e.target.value as (DashboardRole | 'none'))}
                                    className={`w-full bg-slate-950 border ${role === 'none' ? 'border-slate-800 text-slate-600' : role === 'Editor' ? 'border-cyan-500/50 text-cyan-400 font-bold' : 'border-indigo-500/50 text-indigo-400 font-bold'} rounded-lg p-2 text-xs focus:ring-2 focus:ring-cyan-500 outline-none transition-all`}
                                >
                                    <option value="none" className="bg-slate-900 text-slate-500">🚫 Sin Acceso</option>
                                    <option value={DashboardRole.Viewer} className="bg-slate-900 text-white">👁️ Visor</option>
                                    <option value={DashboardRole.Editor} className="bg-slate-900 text-white">📝 Editor</option>
                                </select>
                            </div>
                        )}
                    </td>
                );
            })}

            {/* COLUMNA ACCIONES */}
            <td className="p-4 border-b border-slate-700/50 align-middle sticky right-0 bg-slate-800 shadow-[-4px_0_8px_rgba(0,0,0,0.3)] z-20">
                <div className="flex items-center gap-2 justify-center">
                    {!isCurrentUser && (
                        <>
                            <button
                                onClick={() => onChangePassword(safeUser.id, safeUser.email)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all group/btn"
                                title="Cambiar contraseña"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button
                                onClick={() => onDelete(safeUser.id, safeUser.email)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                title="Eliminar usuario"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
};

const PasswordChangeModal = ({ email, onConfirm, onCancel, isLoading }: { email: string; onConfirm: (password: string) => void; onCancel: () => void; isLoading: boolean; }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = () => {
        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        setError(null);
        onConfirm(newPassword);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200]" onClick={onCancel}>
            <div className="bg-slate-900 border border-slate-700/50 rounded-[2rem] shadow-3xl p-8 w-full max-w-md animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">🔑</div>
                <h4 className="text-2xl font-black text-white text-center mb-2">Cambiar Contraseña</h4>
                <p className="text-center text-slate-500 text-sm mb-8 font-medium">Actualizando acceso para <br /><span className="text-blue-400 font-bold">{email}</span></p>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            autoFocus
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            disabled={isLoading}
                            className="w-full bg-slate-800 border border-white/5 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repetir contraseña"
                            disabled={isLoading}
                            className="w-full bg-slate-800 border border-white/5 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                        />
                    </div>
                </div>

                {error && <p className="text-xs text-rose-400 mt-4 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 flex items-center gap-2 font-bold">⚠️ {error}</p>}

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mt-6">
                    <p className="text-[10px] text-amber-200 font-bold leading-snug">⚠️ Nota: Debido a políticas de seguridad, esto activará un email de confirmación automática en el sistema Firebase.</p>
                </div>

                <div className="flex gap-3 mt-8">
                    <button onClick={onCancel} disabled={isLoading} className="flex-1 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all text-xs uppercase tracking-widest">Cancelar</button>
                    <button onClick={handleSubmit} disabled={isLoading || !newPassword || !confirmPassword} className="flex-2 py-4 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black transition-all text-xs uppercase tracking-widest shadow-xl shadow-blue-900/40 disabled:opacity-50">Actualizar Contraseña</button>
                </div>
            </div>
        </div>
    );
};

export const UserManager = ({ users, dashboards, currentUser, activeClientId, onSave, onCancel, onUserDeleted, groupLabel, availableGroups = [], fullUserList = [] }: { users: User[], dashboards: Dashboard[], currentUser: User, activeClientId: string, onSave: (updatedUsers: User[]) => void, onCancel: () => void, onUserDeleted?: (userId: string) => void, groupLabel?: string, availableGroups?: string[], fullUserList?: User[] }) => {
    const [localUsers, setLocalUsers] = useState<User[]>(() => JSON.parse(JSON.stringify(users)));
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        setLocalUsers(JSON.parse(JSON.stringify(users)));
    }, [users]);

    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [newUserRole, setNewUserRole] = useState<GlobalUserRole | ''>('');
    const [newCanManageKPIs, setNewCanManageKPIs] = useState(false);
    const [newCanExportPPT, setNewCanExportPPT] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [useExisting, setUseExisting] = useState(false);
    const [passwordChangeUser, setPasswordChangeUser] = useState<{ id: string, email: string } | null>(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const handleAccessChange = (userId: string, dashboardId: string | number, role: DashboardRole | 'none') => {
        if (userId === currentUser.id) return;
        setLocalUsers(currentUsers => currentUsers.map(user => {
            if (user.id === userId) {
                const newAccess = { ...user.dashboardAccess };
                if (role === 'none') delete newAccess[dashboardId];
                else newAccess[dashboardId] = role;
                return { ...user, dashboardAccess: newAccess };
            }
            return user;
        }));
    };

    const handleRoleChange = (userId: string, role: GlobalUserRole) => {
        if (userId === currentUser.id) return;
        setLocalUsers(currentUsers => currentUsers.map(user => {
            if (user.id === userId) {
                return { ...user, globalRole: role };
            }
            return user;
        }));
    };

    const handleAddUser = async () => {
        if (!newUserName.trim() || !newUserEmail.trim() || (!useExisting && !newUserPassword.trim()) || !newUserRole) {
            alert("Completa todos los campos obligatorios.");
            return;
        }
        if (!useExisting && newUserPassword !== newUserPasswordConfirm) {
            alert("Las contraseñas no coinciden.");
            return;
        }
        setIsCreating(true);
        try {
            const existingUser = fullUserList.find(u => u.email.trim().toLowerCase() === newUserEmail.trim().toLowerCase());
            let uid = "";

            if (existingUser) {
                const choice = confirm(`El usuario "${newUserEmail}" ya existe en la base de datos global.\n\n- Pulsa ACEPTAR para vincular su cuenta actual a este cliente.\n- Pulsa CANCELAR para intentar crear un registro nuevo.`);
                if (choice) {
                    uid = existingUser.id;
                } else {
                    const result = await firebaseService.createAuthUser(newUserEmail.trim(), newUserPassword, newUserName.trim());
                    uid = result.uid;
                }
            } else {
                const result = await firebaseService.createAuthUser(newUserEmail.trim(), newUserPassword, newUserName.trim());
                uid = result.uid;
            }

            const userToSave: User = {
                id: uid,
                name: newUserName.trim(),
                email: newUserEmail.trim(),
                globalRole: newUserRole as GlobalUserRole,
                canManageKPIs: newCanManageKPIs,
                canExportPPT: newCanExportPPT,
                clientId: activeClientId,
                dashboardAccess: {},
                directorTitle: (newUserRole === GlobalUserRole.Director ? "DIRECTOR" : ""),
                subGroups: []
            };

            await firebaseService.saveUser(userToSave);
            setLocalUsers(prev => [...prev.filter(u => u.id !== uid), userToSave]);
            setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); setNewUserPasswordConfirm(''); setNewUserRole(''); setNewCanManageKPIs(false); setNewCanExportPPT(false);
            alert("✅ Usuario agregado con éxito.");
        } catch (error: any) {
            alert("❌ Error: " + error.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleSaveChanges = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            for (const u of localUsers) {
                const rawSubGroups = u.subGroups || [];
                const cleanedSubGroups = Array.from(new Map<string, string>(rawSubGroups.map(x => [normalizeGroupName(x), x] as [string, string])).values());
                await firebaseService.updateUser({ ...u, subGroups: cleanedSubGroups });
            }
            onSave(localUsers);
            setTimeout(() => onCancel(), 1000);
        } catch (err: any) {
            alert("❌ Fallo Crítico: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[150] p-4 md:p-8" onClick={onCancel}>
            <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-3xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

                {/* HEADER PREMIUM */}
                <div className="p-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 bg-slate-900/50">
                    <div>
                        <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                            <span className="text-cyan-500">🛡️</span> Access Control v6.0.0 (AUDIT)
                        </h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] mt-1">Gestión Unificada de Usuarios y Permisos Estratégicos</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            disabled={isSaving}
                            className={`px-8 py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-cyan-900/20 transition-all flex items-center gap-2 ${isSaving ? 'opacity-50 animate-pulse' : 'hover:scale-105 active:scale-95'}`}
                        >
                            {isSaving ? 'Guardando...' : 'Guardar Todos los Cambios'}
                        </button>
                    </div>
                </div>

                {/* TABLA DE USUARIOS */}
                <div className="flex-grow overflow-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-40">
                            <tr>
                                <th className="p-4 bg-slate-900 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 sticky left-0 z-30 shadow-[4px_0_8px_rgba(0,0,0,0.3)]">Información del Usuario</th>
                                {(dashboards || []).map(d => (
                                    <th key={d.id} className="p-4 bg-slate-900 border-b border-white/10 text-center min-w-[140px] group/th">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider line-clamp-1">{d.title}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[8px] font-bold text-cyan-500/50 uppercase">{(d as any).area || 'General'}</span>
                                                {(d as any)._capturePct !== undefined && (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${(d as any)._capturePct >= 100 ? 'bg-emerald-500/20 text-emerald-400' : (d as any)._capturePct > 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        {Math.round((d as any)._capturePct)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-4 bg-slate-900 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 text-center sticky right-0 z-30 shadow-[-4px_0_8px_rgba(0,0,0,0.3)]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {localUsers.map(u => (
                                <UserRow
                                    key={u.id}
                                    user={u}
                                    dashboards={dashboards || []}
                                    isCurrentUser={u.id === currentUser.id}
                                    isGlobalAdmin={u.globalRole === 'Admin'}
                                    onAccessChange={handleAccessChange}
                                    onRoleChange={handleRoleChange}
                                    onResetPassword={email => firebaseService.sendPasswordResetEmail(email)}
                                    onChangePassword={(id, email) => setPasswordChangeUser({ id, email })}
                                    onDelete={async (id, email) => {
                                        if (confirm(`¿Eliminar permanentemente a ${email}?`)) {
                                            try {
                                                await firebaseService.deleteUserFromFirestore(id);
                                                setLocalUsers(prev => prev.filter(x => x.id !== id));
                                                if (onUserDeleted) onUserDeleted(id);
                                                alert(`✅ Usuario ${email} eliminado correctamente.`);
                                            } catch (err: any) {
                                                alert(`❌ Error al eliminar: ${err.message}`);
                                            }
                                        }
                                    }}
                                    onUpdateUser={updated => setLocalUsers(prev => prev.map(x => x.id === updated.id ? updated : x))}
                                    groupLabel={groupLabel}
                                    availableGroups={availableGroups}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* PANEL AGREGAR USUARIO */}
                <div className="p-8 bg-slate-950/50 border-t border-white/10">
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="flex-grow space-y-4 w-full">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                                    Nuevo Registro de Usuario
                                </h4>
                                <button onClick={() => setUseExisting(!useExisting)} className="text-[9px] font-black text-cyan-500 uppercase tracking-widest hover:text-cyan-400 transition-colors bg-cyan-500/5 px-3 py-1.5 rounded-full border border-cyan-500/20">
                                    {useExisting ? '✨ Crear Credenciales' : '🔍 Vincular Existente'}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {useExisting ? (
                                    <div className="col-span-full">
                                        <select
                                            className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-cyan-500 transition-all outline-none appearance-none"
                                            onChange={e => {
                                                const u = fullUserList.find(x => x.id === e.target.value);
                                                if (u) { setNewUserEmail(u.email); setNewUserName(u.name); setNewUserPassword('***'); }
                                            }}
                                        >
                                            <option value="">-- Seleccionar Usuario de la Base de Datos --</option>
                                            {fullUserList.filter(u => !localUsers.some(lu => lu.id === u.id)).map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <>
                                        <input type="text" placeholder="Nombre completo" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="bg-slate-900 border border-white/5 p-4 rounded-2xl text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600" />
                                        <input type="email" placeholder="Correo electrónico" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="bg-slate-900 border border-white/5 p-4 rounded-2xl text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600" />
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Contraseña"
                                                value={newUserPassword}
                                                onChange={e => setNewUserPassword(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/5 p-4 rounded-2xl text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600 pr-12"
                                            />
                                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400">
                                                {showPassword ? '👁️‍🗨️' : '👁️'}
                                            </button>
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Confirmar"
                                            value={newUserPasswordConfirm}
                                            onChange={e => setNewUserPasswordConfirm(e.target.value)}
                                            className={`bg-slate-900 border p-4 rounded-2xl text-sm text-white focus:ring-2 outline-none transition-all placeholder:text-slate-600 ${newUserPasswordConfirm && newUserPassword !== newUserPasswordConfirm ? 'border-rose-500 focus:ring-rose-500' : 'border-white/5 focus:ring-cyan-500'}`}
                                        />
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-4 pt-2">
                                <select
                                    value={newUserRole}
                                    onChange={e => setNewUserRole(e.target.value as GlobalUserRole)}
                                    className="bg-slate-900 border border-white/5 p-3 px-6 rounded-2xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                                >
                                    <option value="">Rol de Perfil...</option>
                                    <option value="Admin">Administrador</option>
                                    <option value="Director">Director de Área</option>
                                    <option value="Member">Usuario Miembro</option>
                                </select>

                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={newCanManageKPIs} onChange={e => setNewCanManageKPIs(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-white/10 text-cyan-500 focus:ring-0" />
                                        <span className="text-[10px] font-black text-slate-500 group-hover:text-cyan-400 transition-colors uppercase tracking-widest">Crear KPIs</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={newCanExportPPT} onChange={e => setNewCanExportPPT(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-white/10 text-orange-500 focus:ring-0" />
                                        <span className="text-[10px] font-black text-slate-500 group-hover:text-orange-400 transition-colors uppercase tracking-widest">Descargar PPT</span>
                                    </label>
                                </div>

                                <button
                                    onClick={handleAddUser}
                                    disabled={isCreating}
                                    className="ml-auto bg-white text-slate-950 px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-cyan-400 hover:text-white transition-all shadow-xl shadow-white/5 active:scale-95 disabled:opacity-50"
                                >
                                    {isCreating ? 'Procesando...' : 'Agregar Usuario'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL PASSWORD RECOVERY */}
                {passwordChangeUser && (
                    <PasswordChangeModal
                        email={passwordChangeUser.email}
                        onConfirm={async p => {
                            setIsChangingPassword(true);
                            try {
                                // Enviar email real de reset (Firebase Admin no permite cambio directo desde SDK cliente)
                                await firebaseService.sendPasswordResetEmail(passwordChangeUser.email);
                                alert("📧 Se ha enviado un correo de restablecimiento a " + passwordChangeUser.email);
                                setPasswordChangeUser(null);
                            } catch (e: any) {
                                alert("Error: " + e.message);
                            } finally {
                                setIsChangingPassword(false);
                            }
                        }}
                        onCancel={() => setPasswordChangeUser(null)}
                        isLoading={isChangingPassword}
                    />
                )}
            </div>
        </div>
    );
};