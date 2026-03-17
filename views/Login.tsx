
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Autenticar con Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('Correo o contraseña incorrectos.');
        }
        throw new Error(authError.message);
      }

      if (!authData.user) throw new Error('No se pudo obtener la sesión.');

      // 2. Obtener el perfil real con branch_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('No se encontró el perfil del usuario. Contacta al administrador.');
      }

      // 3. Mapear a la interfaz User con el branch_id REAL de la BD
      const user: User = {
        id: profile.id,
        name: profile.full_name || authData.user.email || 'Usuario',
        email: profile.email || authData.user.email || '',
        role: (profile.role as UserRole) || UserRole.SELLER,
        branchId: profile.branch_id || undefined,
        avatar: profile.avatar_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
      };

      onLogin(user);
    } catch (e: any) {
      setError(e.message || 'Error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row bg-background-light dark:bg-background-dark">
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 flex-col justify-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60 transition-transform duration-700 hover:scale-105"
          style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCrMMO43Jn3wJiUKsEM4ff3HyKxBGoUJByS882uUdCgnF5IxUfPwkeJiql99P1vJW2ff4GDByADO4-mH8OoOp3a1z_MwsJkAwa536QhdK6sbrDCn3assu6UbPriyfq-F9zHD8RDyYDB4OKx23KOgkLBQzEKS-eXFNuQbQnZSHYABiz3w59G6bqWq0oU2t2wa5-HuCAAhzr_arzyxzziKW_C3DKzFlb-7m20-83Gm8HQLYo5F3vt0AACsdadRr7yZ8cnbGzoING5ARQ')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <div className="relative z-10 p-16 pb-20 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-primary p-3 rounded-2xl shadow-xl shadow-primary/20">
              <span className="material-symbols-outlined text-white text-4xl">format_paint</span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Pintamax</h2>
          </div>
          <h3 className="text-3xl font-black text-white mb-4 leading-tight">Control Total de Pinturerías</h3>
          <p className="text-lg text-slate-300 font-medium leading-relaxed">
            Gestión inteligente de inventario, ventas y sucursales en un solo lugar.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="w-full max-w-[420px] space-y-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Acceso al Sistema</h1>
            <p className="text-slate-500 font-medium">Por favor ingrese sus datos de acceso.</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm font-bold">
              <span className="material-symbols-outlined text-lg shrink-0">error</span>
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Correo Electrónico</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">mail</span>
                <input
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-primary transition-all font-bold"
                  placeholder="usuario@pintamax.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Contraseña</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">lock</span>
                <input
                  className="w-full pl-12 pr-14 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-primary transition-all font-bold"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  VERIFICANDO...
                </>
              ) : (
                <>
                  INGRESAR AL PANEL
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-tighter pt-8">
            © 2025 Pintamax S.A. de C.V. • Terminal de Gestión
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
