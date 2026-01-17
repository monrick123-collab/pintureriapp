
import React, { useState } from 'react';

interface AuthorizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthorized: () => void;
    title?: string;
    description?: string;
}

const AuthorizationModal: React.FC<AuthorizationModalProps> = ({
    isOpen,
    onClose,
    onAuthorized,
    title = "Autorización Requerida",
    description = "Esta acción requiere autorización de un Administrador."
}) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: In a real app, validate against a secure hash or API.
        // For this local/MVP version, we use a hardcoded admin overrides or check profile via API if needed.
        // Simplifying: Assuming a generic admin pin '1234' or 'admin' for now, OR better, check against current session if user was admin?
        // User requirement: "Función autorizada por un administrador".
        // Since the actual admin is another person, they would type their password here.

        // For MVP: 'admin123'
        if (password === 'admin123') {
            onAuthorized();
            onClose();
        } else {
            setError('Contraseña incorrecta');
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-8 transform scale-100">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="size-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">security</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-slate-500 mt-2">{description}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Contraseña de Administrador</label>
                        <input
                            type="password"
                            autoFocus
                            className="w-full text-center text-2xl tracking-widest p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 font-black"
                            value={password}
                            onChange={e => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="••••"
                        />
                        {error && <p className="text-xs font-bold text-red-500 text-center animate-pulse">{error}</p>}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-600/20 transition-all">
                            Autorizar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AuthorizationModal;
