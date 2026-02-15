
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
import Returns from './views/Returns';
import Supplies from './views/Supplies';
import AiAssistant from './components/AiAssistant';
import Packaging from './views/Packaging';
import SalesHistory from './views/SalesHistory';
import WarehouseDashboard from './views/WarehouseDashboard';
import ShippingNote from './views/ShippingNote';
import WholesalePOS from './views/WholesalePOS';
import WholesaleHistory from './views/WholesaleHistory';
import WholesaleNote from './views/WholesaleNote';
import FinanceDashboard from './views/FinanceDashboard';
import SupplierManagement from './views/SupplierManagement';
import AccountsPayable from './views/AccountsPayable';
import Leasing from './views/Leasing';
import Restocks from './views/Restocks';
import Transfers from './views/Transfers';
import CoinChange from './views/CoinChange';
import CashCut from './views/CashCut';
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
                (user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB) ? <WarehouseDashboard user={user} onLogout={handleLogout} /> :
                  user.role === UserRole.FINANCE ? <Finance user={user} onLogout={handleLogout} /> :
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
          <Route path="/returns" element={user ? <Returns user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/supplies" element={user ? <Supplies user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/packaging" element={user ? <Packaging user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />

          <Route path="/wholesale-pos" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB) ? <WholesalePOS user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/wholesale-history" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB) ? <WholesaleHistory user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/wholesale-note/:id" element={user ? <WholesaleNote /> : <Navigate to="/login" replace />} />

          {/* Finance Routes */}
          <Route path="/finance-dashboard" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <FinanceDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/suppliers" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <SupplierManagement user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/accounts-payable" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <AccountsPayable user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/leases" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <Leasing user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />

          {/* Warehouse Features */}
          <Route path="/restocks" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB) ? <Restocks user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/transfers" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB) ? <Transfers user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/coin-change" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB) ? <CoinChange user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/cash-cut" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB || user?.role === UserRole.FINANCE) ? <CashCut user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {user && <AiAssistant />}
      </div>
    </BrowserRouter>
  );
};

export default App;
