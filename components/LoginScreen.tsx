import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() === '' || password.trim() === '') {
      setError('Por favor, completa todos los campos.');
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al iniciar sesión. ' + (err.message || ''));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-2 drop-shadow-2xl">
            STRATEXA <span className="text-cyan-400">IAPRIORI</span>
          </h1>
          <div className="flex items-center justify-center gap-3">
            <span className="h-[1px] w-8 bg-slate-700" />
            <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px]">Business Intelligence System</p>
            <span className="h-[1px] w-8 bg-slate-700" />
          </div>
        </div>

        <div className="glass-panel rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                Credencial de Acceso
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all placeholder:text-slate-700 font-medium"
                placeholder="usuario@prior.ai"
                autoFocus
                disabled={isLoggingIn}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
                Código de Seguridad
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all placeholder:text-slate-700 font-medium"
                placeholder="••••••••"
                disabled={isLoggingIn}
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] p-4 rounded-xl font-bold text-center animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full group relative flex items-center justify-center p-0.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:grayscale"
            >
              <div className="w-full h-full bg-slate-950 rounded-[0.9rem] py-4 flex items-center justify-center group-hover:bg-transparent transition-colors">
                {isLoggingIn ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-white">Autenticar Sistema</span>
                )}
              </div>
            </button>
          </form>
        </div>

        <footer className="text-center mt-12 space-y-2">
          <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} STRATEXA IAPRIORI • Business Intelligence System
          </p>
        </footer>
      </div>
    </div>
  );
};
