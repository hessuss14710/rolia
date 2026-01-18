import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { AuthProvider, useAuth } from './services/AuthContext';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';
import CharacterCreate from './pages/CharacterCreate';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/rol/login" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/rol/login" element={<Login />} />
          <Route path="/rol" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
          <Route path="/rol/room/:code" element={<ProtectedRoute><Room /></ProtectedRoute>} />
          <Route path="/rol/room/:code/character" element={<ProtectedRoute><CharacterCreate /></ProtectedRoute>} />
          <Route path="/rol/room/:code/game" element={<ProtectedRoute><Game /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/rol" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
