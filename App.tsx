
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './views/Login';
import POS from './views/POS';
import Dashboard from './views/Dashboard';
import Finance from './views/Finance';
import Inventory from './views/Inventory';
import UserManagement from './views/UserManagement';
import Clients from './views/Clients';
import Branches from './views/Branches';
import Quotations from './views/Quotations';
import SalesHistory from './views/SalesHistory';
import WarehouseDashboard from './views/WarehouseDashboard';
import ShippingNote from './views/ShippingNote';
import { User, UserRole } from './types';

const App: React.FC = () => {
  // ... existing hook ...
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('pintamax_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user session:", e);
        localStorage.removeItem('pintamax_user');
      }
    }
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('pintamax_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pintamax_user');
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />

          <Route path="/" element={
            user ? (
              user.role === UserRole.ADMIN ? <Dashboard user={user} onLogout={handleLogout} /> :
                user.role === UserRole.WAREHOUSE ? <WarehouseDashboard user={user} onLogout={handleLogout} /> :
                  <POS user={user} onLogout={handleLogout} />
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/pos" element={user ? <POS user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />

          <Route path="/finance" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <Finance user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/inventory" element={user ? <Inventory user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/sales-history" element={user ? <SalesHistory user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/shipping-note/:id" element={user ? <ShippingNote /> : <Navigate to="/login" replace />} />
          <Route path="/users" element={user?.role === UserRole.ADMIN ? <UserManagement user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/clients" element={user ? <Clients user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/branches" element={user?.role === UserRole.ADMIN ? <Branches user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/quotations" element={user ? <Quotations user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
