import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';

// Customer-facing pages
import CustomerMenu from './pages/customer/Menu';
import CustomerCheckout from './pages/customer/Checkout';
import CustomerOrderConfirmation from './pages/customer/OrderConfirmation';
import CustomerLanding from './pages/customer/CustomerLanding';

// Staff portal pages
import StaffLogin from './pages/staff/Login';
import StaffDashboard from './pages/staff/Dashboard';
import OrderManagement from './pages/staff/OrderManagement';
import POSInterface from './pages/staff/POSInterface';
import MenuManagement from './pages/staff/MenuManagement';
import UserManagement from './pages/staff/UserManagement';
import Reports from './pages/staff/Reports';
import Settings from './pages/staff/Settings';
import Expenses from './pages/staff/Expenses';
import TableManagement from './pages/staff/TableManagement';

// Layout components
import CustomerLayout from './components/layout/CustomerLayout';
import StaffLayout from './components/layout/StaffLayout';

// Protected route component
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Customer-facing routes */}
              <Route path="/" element={
                <CustomerLayout>
                  <CustomerMenu />
                </CustomerLayout>
              } />

              <Route path="/checkout" element={
                <CustomerLayout>
                  <CustomerCheckout />
                </CustomerLayout>
              } />

              <Route path="/order-confirmation/:orderNumber" element={
                <CustomerLayout>
                  <CustomerOrderConfirmation />
                </CustomerLayout>
              } />

              <Route path="/menu/table/:tableNumber" element={<CustomerLanding />} />

              {/* Staff login */}
              <Route path="/staff/login" element={<StaffLogin />} />

              {/* Staff portal routes */}
              <Route path="/staff" element={
                <ProtectedRoute>
                  <StaffLayout>
                    <StaffDashboard />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/orders" element={
                <ProtectedRoute>
                  <StaffLayout>
                    <OrderManagement />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/pos" element={
                <ProtectedRoute>
                  <StaffLayout>
                    <POSInterface />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/menu" element={
                <ProtectedRoute>
                  <StaffLayout>
                    <MenuManagement />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/users" element={
                <ProtectedRoute requiredRoles={['owner', 'admin']}>
                  <StaffLayout>
                    <UserManagement />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/reports" element={
                <ProtectedRoute requiredRoles={['owner', 'admin']}>
                  <StaffLayout>
                    <Reports />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/expenses" element={
                <ProtectedRoute requiredRoles={['owner', 'admin']}>
                  <StaffLayout>
                    <Expenses />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/tables" element={
                <ProtectedRoute requiredRoles={['owner', 'admin']}>
                  <StaffLayout>
                    <TableManagement />
                  </StaffLayout>
                </ProtectedRoute>
              } />

              <Route path="/staff/settings" element={
                <ProtectedRoute requiredRoles={['owner', 'admin']}>
                  <StaffLayout>
                    <Settings />
                  </StaffLayout>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
