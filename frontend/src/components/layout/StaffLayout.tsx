import React, { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

interface StaffLayoutProps {
  children: ReactNode;
}

const StaffLayout: React.FC<StaffLayoutProps> = ({ children }) => {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/staff/login');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/staff',
      icon: HomeIcon,
      roles: ['owner', 'admin', 'cashier'],
    },
    {
      name: 'Orders',
      href: '/staff/orders',
      icon: ClipboardDocumentListIcon,
      roles: ['owner', 'admin', 'cashier'],
    },
    {
      name: 'POS',
      href: '/staff/pos',
      icon: ShoppingCartIcon,
      roles: ['owner', 'admin', 'cashier'],
    },
    {
      name: 'Menu',
      href: '/staff/menu',
      icon: Cog6ToothIcon,
      roles: ['owner', 'admin', 'cashier'],
    },
    {
      name: 'Inventory',
      href: '/staff/inventory',
      icon: ArchiveBoxIcon,
      roles: ['owner', 'admin', 'cashier', 'manager'],
    },
    {
      name: 'Users',
      href: '/staff/users',
      icon: UserGroupIcon,
      roles: ['owner', 'admin'],
    },
    {
      name: 'Tables',
      href: '/staff/tables',
      icon: Bars3Icon,
      roles: ['owner', 'admin'],
    },
    {
      name: 'Reports',
      href: '/staff/reports',
      icon: ChartBarIcon,
      roles: ['owner', 'admin'],
    },
    {
      name: 'Expenses',
      href: '/staff/expenses',
      icon: ClipboardDocumentListIcon,
      roles: ['owner', 'admin'],
    },
    {
      name: 'Settings',
      href: '/staff/settings',
      icon: Cog6ToothIcon,
      roles: ['owner', 'admin'],
    },
  ];

  const filteredNavigation = navigation.filter(item => hasRole(item.roles));

  return (
    <div className="min-h-screen bg-brown-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-brown-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">☕</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-brown-900 leading-tight">Orijin POS</span>
              <span className="text-xs text-brown-600">Staff Portal</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive
                    ? 'bg-amber-50 text-amber-900'
                    : 'text-brown-700 hover:bg-brown-50 hover:text-brown-900'
                    }`}
                >
                  <item.icon
                    className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-amber-700' : 'text-brown-400 group-hover:text-brown-600'
                      }`}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info and logout */}
        <div className="flex-shrink-0 p-4 border-t border-brown-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-amber-900">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brown-900 truncate">{user?.username}</p>
                <p className="text-xs text-brown-600 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-brown-500 hover:text-brown-700 hover:bg-brown-100 rounded-md transition-colors duration-200 flex-shrink-0"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content wrapper */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex-shrink-0 bg-white shadow-sm border-b border-brown-200 sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-brown-500 hover:text-brown-700 hover:bg-brown-100"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>

            <div className="flex items-center space-x-4 lg:ml-auto">
              <Link
                to="/"
                className="text-sm text-brown-700 hover:text-amber-700 transition-colors duration-200 whitespace-nowrap"
              >
                View Orijins Site
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-amber-900">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-brown-900 hidden sm:block whitespace-nowrap">
                  {user?.username}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;