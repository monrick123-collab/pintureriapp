
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { MOCK_USER } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('admin')) {
      onLogin({ ...MOCK_USER, role: UserRole.ADMIN, name: 'Administrador' });
    } else if (email.includes('bodega')) {
      // Import this dynamically or assume it's available via previous tool update, 
      // but simpler to just inline the mock or import if possible. 
      // To avoid import errors if the previous tool didn't export it yet or imports are strict, 
      // I will import it in the notification or assume usage.
      // Actually best practice is to import it. I'll need to update imports first or inline it.
      // Let's rely on the updated constants file.
      // Wait, I need to update the import in Login.tsx first or uses require? No, typescript.
      // I should update the import line in Login.tsx as well.
      // I'll do this in a separate step or try to add it here if I can view the file imports.
      // Actually, I can just use a hardcoded object here for safety if imports are tricky in one go.
      // But I replaced constants.tsx, so I can import it.
      // I will update Login.tsx imports in the next step.
      // For now, let's just make the change relying on the Variable name, 
      // and I will update the import in the next tool call to be safe.
      // OR better: I can construct the user here like the Admin case.
      onLogin({ ...MOCK_USER, role: UserRole.WAREHOUSE, name: 'Encargado Bodega', branchId: 'BR-MAIN', id: 'WH-001' });
    } else if (email.includes('contador')) {
      onLogin({ ...MOCK_USER, role: UserRole.FINANCE, name: 'Contador de Pruebas', branchId: 'BR-MAIN', id: 'ACC-001' });
    } else {
      onLogin(MOCK_USER);
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
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              INGRESAR AL PANEL
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
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
