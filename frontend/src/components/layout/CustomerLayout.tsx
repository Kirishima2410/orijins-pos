import React, { ReactNode, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { ShoppingCartIcon, UserIcon } from '@heroicons/react/24/outline';
import { settingsAPI } from '../../utils/api';
import { ShopInfo } from '../../types';

interface CustomerLayoutProps {
  children: ReactNode;
}

const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  const { getTotalItems, getTotalAmount } = useCart();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);

  useEffect(() => {
    const fetchShopInfo = async () => {
      try {
        const response = await settingsAPI.getShopInfo();
        setShopInfo(response.data as any);
      } catch (error) {
        console.error('Error fetching shop info:', error);
      }
    };

    fetchShopInfo();
  }, []);

  return (
    <div className="min-h-screen bg-brown-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-brown-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">☕</span>
              </div>
              <span className="text-xl font-bold text-brown-900">Orijins</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                className="text-brown-700 hover:text-primary-700 transition-colors duration-200"
              >
                Menu
              </Link>
              <Link
                to="/about"
                className="text-brown-700 hover:text-primary-700 transition-colors duration-200"
              >
                About
              </Link>
              <Link
                to="/contact"
                className="text-brown-700 hover:text-primary-700 transition-colors duration-200"
              >
                Contact
              </Link>
            </nav>

            {/* Cart and Login */}
            <div className="flex items-center space-x-4">
              {/* Cart */}
              <Link
                to="/checkout"
                className="relative p-2 text-brown-700 hover:text-primary-700 transition-colors duration-200"
              >
                <ShoppingCartIcon className="w-6 h-6" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getTotalItems()}
                  </span>
                )}
              </Link>

              {/* Staff Login */}
              <Link
                to="/staff/login"
                className="flex items-center space-x-1 text-brown-700 hover:text-primary-700 transition-colors duration-200"
              >
                <UserIcon className="w-5 h-5" />
                <span className="hidden sm:block text-sm">Staff Login</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-brown-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Company Info */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">☕</span>
                </div>
                <span className="text-xl font-bold">{shopInfo?.shop_name || 'Orijins'}</span>
              </div>
              <p className="text-brown-100 mb-4">
                Your neighborhood coffee shop serving the finest brews and delicious treats.
              </p>
              <div className="space-y-2 text-sm text-brown-100">
                <p>📍 {shopInfo?.shop_address || '123 Main Street, City, Country'}</p>
                <p>📞 {shopInfo?.shop_phone || '+1-234-567-8900'}</p>
                <p>✉️ {shopInfo?.shop_email || 'info@coffeeshop.com'}</p>
              </div>
            </div>

            {/* Hours */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Business Hours</h3>
              <div className="space-y-2 text-sm text-gray-300">
                {shopInfo?.business_hours ? (
                  Object.entries(shopInfo.business_hours).map(([day, hours]) => (
                    <p key={day} className="capitalize">{day}: {hours}</p>
                  ))
                ) : (
                  <>
                    <p>Monday - Friday: 7:00 AM - 6:00 PM</p>
                    <p>Saturday: 8:00 AM - 5:00 PM</p>
                    <p>Sunday: 9:00 AM - 4:00 PM</p>
                  </>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link
                  to="/"
                  className="block text-sm text-gray-300 hover:text-white transition-colors duration-200"
                >
                  Menu
                </Link>
                <Link
                  to="/about"
                  className="block text-sm text-gray-300 hover:text-white transition-colors duration-200"
                >
                  About Us
                </Link>
                <Link
                  to="/contact"
                  className="block text-sm text-gray-300 hover:text-white transition-colors duration-200"
                >
                  Contact
                </Link>
                <Link
                  to="/staff/login"
                  className="block text-sm text-gray-300 hover:text-white transition-colors duration-200"
                >
                  Staff Portal
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 Coffee Shop. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Cart Summary (Mobile) */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary-600 text-white p-4 md:hidden z-50">
          <Link to="/checkout" className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShoppingCartIcon className="w-6 h-6" />
              <span className="font-medium">
                {getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''} in cart
              </span>
            </div>
            <div className="text-lg font-bold">
              ${getTotalAmount().toFixed(2)}
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default CustomerLayout;
