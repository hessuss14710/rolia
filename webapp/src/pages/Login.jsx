import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, username);
      } else {
        await login(email, password);
      }
      navigate('/rol');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Animated backgrounds */}
      <div className="bg-animation" />
      <div className="stars" />
      <div className="grid-overlay" />

      {/* Floating decorations */}
      <div className="fixed top-[15%] left-[8%] text-5xl opacity-20 floating">🎲</div>
      <div className="fixed top-[60%] right-[10%] text-4xl opacity-20 floating floating-delay-1">⚔️</div>
      <div className="fixed bottom-[20%] left-[12%] text-5xl opacity-20 floating floating-delay-2">🐉</div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Logo and Title */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="logo-text text-5xl sm:text-6xl mb-3">ROLIA</h1>
          <p className="text-gray-400 text-lg tracking-wide">Aventuras de rol con narrador IA</p>
        </div>

        {/* Glowing badge */}
        <div className="badge-cyber mb-8">
          ✨ IA en tiempo real
        </div>

        {/* Form Card */}
        <div className="glass rounded-3xl p-8 w-full max-w-md animate-scale-in">
          <h2 className="font-display text-2xl font-bold text-center mb-8 tracking-wider uppercase">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="animate-fade-in">
                <label className="block text-sm text-gray-400 mb-2 font-medium tracking-wide uppercase">
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-cyber w-full"
                  placeholder="Tu nombre en el juego"
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium tracking-wide uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-cyber w-full"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2 font-medium tracking-wide uppercase">
                Contrasena
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-cyber w-full"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm animate-fade-in">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  {error}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-neon w-full py-4 text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <>
                  <span>{isRegister ? '🚀' : '⚡'}</span>
                  {isRegister ? 'Crear cuenta' : 'Entrar'}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-neon-purple hover:text-neon-pink transition-colors font-medium"
            >
              {isRegister ? '← Ya tengo cuenta' : 'No tengo cuenta →'}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-3 gap-6 text-center max-w-lg animate-fade-in">
          <div className="group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎲</div>
            <div className="text-sm text-gray-400 font-medium">Dados integrados</div>
          </div>
          <div className="group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎭</div>
            <div className="text-sm text-gray-400 font-medium">IA narradora</div>
          </div>
          <div className="group">
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎤</div>
            <div className="text-sm text-gray-400 font-medium">Chat de voz</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-600 text-sm">
          Powered by Groq + Llama 3.1
        </div>
      </div>
    </div>
  );
}
