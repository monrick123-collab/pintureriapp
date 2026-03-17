
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
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
import ReturnNote from './views/ReturnNote';
import CoinChangeNote from './views/CoinChangeNote';
import Supplies from './views/Supplies';
import AiAssistant from './components/AiAssistant';
import Packaging from './views/Packaging';
import Toast from './components/ui/Toast';

import WarehouseDashboard from './views/WarehouseDashboard';
import ShippingNote from './views/ShippingNote';
import WholesalePOS from './views/WholesalePOS';

import WholesaleNote from './views/WholesaleNote';
import MunicipalPOS from './views/MunicipalPOS';
import FinanceDashboard from './views/FinanceDashboard';
import SupplierManagement from './views/SupplierManagement';
import AccountsPayable from './views/AccountsPayable';
import Leasing from './views/Leasing';
import Restocks from './views/Restocks';
import Transfers from './views/Transfers';
import CoinChange from './views/CoinChange';
import CashCut from './views/CashCut';
import AdminCashCuts from './views/AdminCashCuts';
import AdminPromotionRequests from './views/AdminPromotionRequests';
import RestockNote from './views/RestockNote';
import AdminHistory from './views/AdminHistory';
import AdminPendingPayments from './views/AdminPendingPayments';
import { UserRole } from './types';
import { useAuthStore } from './store/authStore';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const { user, setUser, login, logout } = useAuthStore();

  useEffect(() => {
    // Validate session against Supabase Auth on startup
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Active Supabase session — fetch fresh profile
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            const freshUser = {
              id: profile.id,
              name: profile.full_name || session.user.email || 'Usuario',
              email: profile.email || session.user.email || '',
              role: profile.role,
              branchId: profile.branch_id || undefined,
              avatar: profile.avatar_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            };
            setUser(freshUser);
            localStorage.setItem('pintamax_user', JSON.stringify(freshUser));
            return;
          }
        } catch (e) {
          console.error('Error fetching profile:', e);
        }
      }

      // No valid Supabase session — clear any stale localStorage data
      localStorage.removeItem('pintamax_user');
      setUser(null);
    };

    initSession();

    // Listen for auth changes (login/logout from other tabs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        localStorage.removeItem('pintamax_user');
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  const handleLogin = (u: any) => {
    login(u);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <BrowserRouter>
      <ErrorBoundary>
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

          <Route path="/shipping-note/:id" element={user ? <ShippingNote /> : <Navigate to="/login" replace />} />
          <Route path="/users" element={user?.role === UserRole.ADMIN ? <UserManagement user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/clients" element={user ? <Clients user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/branches" element={user?.role === UserRole.ADMIN ? <Branches user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/quotations" element={user ? <Quotations user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/returns" element={user ? <Returns user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/returns/:id/print" element={user ? <ReturnNote /> : <Navigate to="/login" replace />} />
          <Route path="/coin-change/:id/print" element={user ? <CoinChangeNote /> : <Navigate to="/login" replace />} />
          <Route path="/restocks/:id/print" element={user ? <RestockNote user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/supplies" element={user ? <Supplies user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
          <Route path="/packaging" element={user ? <Packaging user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />

          <Route path="/wholesale-pos" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB || user?.role === UserRole.STORE_MANAGER) ? <WholesalePOS user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />

          <Route path="/wholesale-note/:id" element={user ? <WholesaleNote /> : <Navigate to="/login" replace />} />
          <Route path="/municipal-pos" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.STORE_MANAGER || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB) ? <MunicipalPOS user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/admin/history" element={user?.role === UserRole.ADMIN ? <AdminHistory user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/admin/pending-payments" element={user?.role === UserRole.ADMIN ? <AdminPendingPayments user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/admin/promotions" element={user?.role === UserRole.ADMIN ? <AdminPromotionRequests user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />

          {/* Finance Routes */}
          <Route path="/finance-dashboard" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <FinanceDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/suppliers" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <SupplierManagement user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/accounts-payable" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <AccountsPayable user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/leases" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.FINANCE) ? <Leasing user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />

          {/* Warehouse Features */}
          <Route path="/restocks" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB || user?.role === UserRole.STORE_MANAGER) ? <Restocks user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/transfers" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB || user?.role === UserRole.STORE_MANAGER) ? <Transfers user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/coin-change" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB || user?.role === UserRole.STORE_MANAGER) ? <CoinChange user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/cash-cut" element={(user?.role === UserRole.ADMIN || user?.role === UserRole.WAREHOUSE || user?.role === UserRole.WAREHOUSE_SUB || user?.role === UserRole.FINANCE || user?.role === UserRole.STORE_MANAGER) ? <CashCut user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />
          <Route path="/admin-cash-cuts" element={(user?.role === UserRole.ADMIN) ? <AdminCashCuts user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {user && <AiAssistant />}
        <Toast />
      </div>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
