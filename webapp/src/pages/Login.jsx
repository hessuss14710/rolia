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
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo and Title */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-fantasy font-bold text-rolia-400 mb-2">RolIA</h1>
        <p className="text-gray-400">Aventuras de rol con narrador IA</p>
      </div>

      {/* Form Card */}
      <div className="glass rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center mb-6">
          {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre de usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500"
                placeholder="Tu nombre en el juego"
                required
                minLength={2}
                maxLength={50}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500"
              placeholder="******"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rolia-600 hover:bg-rolia-500 disabled:bg-rolia-800 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="spinner"></span>
            ) : isRegister ? (
              'Crear cuenta'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-rolia-400 hover:text-rolia-300 text-sm"
          >
            {isRegister ? 'Ya tengo cuenta' : 'No tengo cuenta'}
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center max-w-md">
        <div className="text-gray-400">
          <div className="text-2xl mb-1">🎲</div>
          <div className="text-xs">Dados integrados</div>
        </div>
        <div className="text-gray-400">
          <div className="text-2xl mb-1">🎭</div>
          <div className="text-xs">IA narradora</div>
        </div>
        <div className="text-gray-400">
          <div className="text-2xl mb-1">🎤</div>
          <div className="text-xs">Chat de voz</div>
        </div>
      </div>
    </div>
  );
}
