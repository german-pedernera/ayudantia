import { useState, useEffect } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { sendAccessNotification } from '../services/telegram';

const loginData = [
  { id: 1, jerarquía: 'Cte Pr', name: 'SKIEBACK, José Marcelo', usuario: '27433769', clave: '63864', fechaNacimiento: '1979-05-15' },
  { id: 2, jerarquía: '1er Alf', name: 'RAMIREZ PEDERNERA, Germán Andrés', usuario: '32559315', clave: '70965', fechaNacimiento: '1986-08-22' },
  { id: 3, jerarquía: 'Sarg 1ro', name: 'RIVAS, Noelia', usuario: '29339676', clave: '67186', fechaNacimiento: '1982-11-10' }
];

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Ensure inputs are empty on mount and prevent browser autofill retention
    setUsername('');
    setPassword('');
    const form = document.getElementById('login-form');
    if (form) form.reset();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate small delay for better UX and allow trim
    setTimeout(async () => {
      const cleanUser = username.trim();
      const cleanPass = password.trim();
      
      const user = loginData.find(u => u.usuario === cleanUser && u.clave === cleanPass);
      
      if (user) {
        await sendAccessNotification(user);
        onLogin(user);
      } else {
        // Send notification for failed attempt
        await sendAccessNotification({ name: username, jerarquía: 'Desconocido' }, false);
        setError('Usuario o clave incorrectos');
        setLoading(false);
        setPassword('');
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sky-100 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white border border-slate-200 p-10 space-y-8 rounded-[2.5rem] shadow-2xl shadow-sky-200"
      >
        <div className="flex flex-col items-center">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-32 h-32 rounded-3xl flex items-center justify-center mb-8 shadow-2xl p-2"
          >
            <img 
              src="/assets/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
            />
          </motion.div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight text-center uppercase">Sistema Ayudantía</h2>
          <p className="text-project-600 font-bold mt-2 uppercase tracking-widest text-xs">Gendarmería Nacional Argentina</p>
        </div>

        <form id="login-form" onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Usuario (MI)</label>
            <input 
              type="text" 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-project-500 outline-none transition-all duration-200 text-slate-900 placeholder:text-slate-400"
              placeholder="Ingrese su MI"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Clave (CE)</label>
            <div className="relative group">
              <input 
                type={showPassword ? "text" : "password"} 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-project-500 outline-none transition-all duration-200 text-slate-900 placeholder:text-slate-400 pr-14"
                placeholder="Ingrese su CE"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-project-600 transition-colors p-2"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 text-red-600 text-xs font-bold py-2 px-4 rounded-xl text-center border border-red-200"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-project-600 text-white hover:bg-project-700 font-bold py-4 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-project-200 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
            ) : 'Ingresar al Sistema'}
          </button>
        </form>

        <div className="text-center text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold pt-4">
          Acceso Restringido • Personal Autorizado
        </div>
      </motion.div>
    </div>
  );

};

export default Login;
