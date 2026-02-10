import React, { useState, useEffect } from 'react';

interface GroupRenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentGroupName: string;
    onConfirm: (newName: string) => Promise<void>;
    onDelete?: (groupName: string) => Promise<void>;
}

export const GroupRenameModal: React.FC<GroupRenameModalProps> = ({
    isOpen,
    onClose,
    currentGroupName,
    onConfirm,
    onDelete
}) => {
    const [newName, setNewName] = useState(currentGroupName);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setNewName(currentGroupName);
        }
    }, [isOpen, currentGroupName]);

    const handleSave = async () => {
        if (!newName.trim()) {
            alert("El nombre del grupo no puede estar vacío");
            return;
        }
        if (newName.trim() === currentGroupName) {
            onClose();
            return;
        }

        setIsSaving(true);
        try {
            await onConfirm(newName.trim());
            onClose();
        } catch (error) {
            console.error("Error renaming group:", error);
            alert("Error al renombrar el grupo. Por favor intenta de nuevo.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70]" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Renombrar Grupo</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Nuevo Nombre
                        </label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600 uppercase"
                            placeholder="Ej: ZONA NORTE"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') onClose();
                            }}
                        />
                        <p className="text-[10px] text-slate-500 mt-2">
                            Esto actualizará el nombre del grupo en todos los tableros asociados a él.
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center gap-3">
                    {onDelete && (
                        <button
                            onClick={() => {
                                if (confirm(`¿Estás seguro de eliminar el grupo "${currentGroupName}"?\n\nLos tableros asociados seguirán existiendo pero dejarán de pertenecer a este grupo.`)) {
                                    setIsSaving(true);
                                    onDelete(currentGroupName).then(() => onClose()).finally(() => setIsSaving(false));
                                }
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            disabled={isSaving}
                        >
                            Eliminar Grupo
                        </button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !newName.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Guardando...
                                </>
                            ) : (
                                "Renombrar"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
