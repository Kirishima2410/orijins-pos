import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { ordersAPI, settingsAPI } from '../../utils/api';
import { ShopInfo } from '../../types';
import { TrashIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';

const CustomerCheckout: React.FC = () => {
  const { items, updateQuantity, removeItem, getTotalAmount, clearCart } = useCart();
  const navigate = useNavigate();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [gcashQR, setGcashQR] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    loadShopInfo();
  }, []);

  useEffect(() => {
    if (paymentMethod === 'gcash' && shopInfo?.gcash_number) {
      generateGCashQR();
    }
  }, [paymentMethod, shopInfo]);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/');
    }
  }, [items, navigate]);

  const loadShopInfo = async () => {
    try {
      const response = await settingsAPI.getShopInfo();
      setShopInfo(response.data);
    } catch (error) {
      console.error('Error loading shop info:', error);
    }
  };

  const generateGCashQR = async () => {
    if (!shopInfo?.gcash_number) return;

    try {
      const qrData = `gcash://pay?phone=${shopInfo.gcash_number}&amount=${getTotalAmount()}`;
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setGcashQR(qrCodeDataURL);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleQuantityChange = (itemId: number, change: number, variantId?: number) => {
    const item = items.find(i => i.menu_item.id === itemId && (i.variant?.id || 0) === (variantId || 0));
    if (item) {
      const newQuantity = item.quantity + change;
      if (newQuantity <= 0) {
        removeItem(itemId, variantId);
      } else {
        updateQuantity(itemId, newQuantity, variantId);
      }
    }
  };

  const handleRemoveItem = (itemId: number, variantId?: number) => {
    removeItem(itemId, variantId);
    toast.success('Item removed from cart');
  };

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        items: items.map(item => ({
          menu_item_id: item.menu_item.id,
          menu_item_variant_id: item.variant?.id,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        customer_name: customerName.trim() || null,
      };

      const response = await ordersAPI.create(orderData);
      
      if (response.data.order) {
        clearCart();
        toast.success('Order placed successfully!');
        navigate(`/order-confirmation/${response.data.order.order_number}`);
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to place order. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return null; // Will redirect to home page
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
        <p className="text-gray-600">Review your order and complete your purchase</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Summary */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">Order Summary</h2>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={`${item.menu_item.id}-${item.variant?.id || 0}`} className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.menu_item.name} {item.variant?.size_label ? `(${item.variant.size_label})` : ''}</h3>
                      <p className="text-sm text-gray-600">₱{(item.variant?.price ?? item.menu_item.price).toFixed(2)} each</p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleQuantityChange(item.menu_item.id, -1, item.variant?.id)}
                          className="p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                        >
                          <MinusIcon className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(item.menu_item.id, 1, item.variant?.id)}
                          className="p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                        >
                          <PlusIcon className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          ₱{(((item.variant?.price ?? item.menu_item.price)) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveItem(item.menu_item.id, item.variant?.id)}
                        className="p-2 text-gray-400 hover:text-danger-600 transition-colors duration-200"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="card mt-6">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">Customer Information</h2>
            </div>
            <div className="card-body">
              <div>
                <label className="label">Name (Optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name for the order"
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment and Order */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <div className="card-header">
              <h2 className="text-xl font-semibold text-gray-900">Payment</h2>
            </div>
            <div className="card-body space-y-6">
              {/* Payment Method */}
              <div>
                <label className="label">Payment Method</label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash')}
                      className="mr-3"
                    />
                    <span className="text-gray-700">Cash</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="gcash"
                      checked={paymentMethod === 'gcash'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'gcash')}
                      className="mr-3"
                    />
                    <span className="text-gray-700">GCash</span>
                  </label>
                </div>
              </div>

              {/* GCash QR Code */}
              {paymentMethod === 'gcash' && (
                <div>
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="btn btn-outline w-full"
                  >
                    {showQR ? 'Hide' : 'Show'} GCash QR Code
                  </button>
                  
                  {showQR && gcashQR && (
                    <div className="mt-4 text-center">
                      <div className="inline-block p-4 bg-white border border-gray-200 rounded-lg">
                        <img src={gcashQR} alt="GCash QR Code" className="mx-auto" />
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        Scan to pay ₱{getTotalAmount().toFixed(2)}
                      </p>
                      {shopInfo?.gcash_number && (
                        <p className="text-xs text-gray-500 mt-1">
                          Or send to: {shopInfo.gcash_number}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Order Total */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center text-lg font-semibold text-gray-900">
                  <span>Total</span>
                  <span>₱{getTotalAmount().toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handleSubmitOrder}
                disabled={loading || items.length === 0}
                className="btn btn-primary w-full btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="loading-dots">
                      <div></div>
                      <div></div>
                      <div></div>
                    </div>
                    <span className="ml-2">Placing Order...</span>
                  </div>
                ) : (
                  'Place Order'
                )}
              </button>

              {/* Continue Shopping */}
              <button
                onClick={() => navigate('/')}
                className="btn btn-outline w-full"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCheckout;
