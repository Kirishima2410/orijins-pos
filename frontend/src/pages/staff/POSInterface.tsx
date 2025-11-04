import React, { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { menuAPI, ordersAPI } from '../../utils/api';
import { Category, MenuItem, MenuItemVariant } from '../../types';
import {
  PlusIcon,
  MinusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const POSInterface: React.FC = () => {
  const { items, addItem, updateQuantity, removeItem, getTotalAmount, clearCart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesResponse, itemsResponse] = await Promise.all([
        menuAPI.getCategories(),
        menuAPI.getItems()
      ]);

      setCategories(categoriesResponse.data);
      setMenuItems(itemsResponse.data);
    } catch (error) {
      console.error('Error loading menu data:', error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === null || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch && item.is_available && item.stock_quantity > 0;
  });

  const handleAddToCart = (item: MenuItem) => {
    // choose default variant if available: the cheapest available
    const variant: MenuItemVariant | undefined = (item.variants && item.variants.length)
      ? [...item.variants].sort((a,b) => (a.price - b.price))[0]
      : undefined;
    addItem(item, 1, variant);
    const label = variant?.size_label || variant?.variant_name;
    toast.success(`${item.name}${label ? ` (${label})` : ''} added to cart`);
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
      toast.error('Cart is empty');
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
        setCustomerName('');
        toast.success('Order placed successfully!');
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

  const handlePrintReceipt = () => {
    // This would integrate with a receipt printer
    toast.success('Receipt sent to printer');
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">POS Interface</h1>
        <p className="mt-2 text-gray-600">
          Point of Sale system for counter orders
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search and Categories */}
          <div className="card">
            <div className="card-body">
              <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                      selectedCategory === null
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    All Items
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                        selectedCategory === category.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="card hover:shadow-md transition-shadow duration-200 cursor-pointer"
                onClick={() => handleAddToCart(item)}
              >
                <div className="card-body p-4">
                  <div className="h-20 bg-gray-200 rounded-lg flex items-center justify-center mb-3">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-3xl text-gray-400">☕</span>
                    )}
                  </div>
                  
                  <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
                    {item.name}
                  </h3>
                  
                  <p className="text-lg font-bold text-primary-600">
                    ₱{item.price.toFixed(2)}
                  </p>
                  
                  {item.stock_quantity <= item.low_stock_threshold && (
                    <p className="text-xs text-warning-600 mt-1">
                      Only {item.stock_quantity} left
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
              <p className="text-gray-600">
                {searchTerm || selectedCategory
                  ? 'Try adjusting your search or category filter.'
                  : 'No menu items available.'}
              </p>
            </div>
          )}
        </div>

        {/* Cart Section */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <ShoppingCartIcon className="w-5 h-5 mr-2" />
                Current Order
              </h2>
            </div>
            
            <div className="card-body">
              {items.length > 0 ? (
                <div className="space-y-4">
                  {/* Cart Items */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {items.map((item) => (
                      <div key={`${item.menu_item.id}-${item.variant?.id || 0}`} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">{item.menu_item.name} {item.variant?.size_label ? `(${item.variant.size_label})` : ''}</h4>
                          <p className="text-xs text-gray-600">₱{(item.variant?.price ?? item.menu_item.price).toFixed(2)} each</p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleQuantityChange(item.menu_item.id, -1, item.variant?.id)}
                            className="p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                          >
                            <MinusIcon className="w-3 h-3 text-gray-600" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item.menu_item.id, 1, item.variant?.id)}
                            className="p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                          >
                            <PlusIcon className="w-3 h-3 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.menu_item.id, item.variant?.id)}
                            className="p-1 text-gray-400 hover:text-danger-600 transition-colors duration-200 ml-2"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Customer Information */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="space-y-3">
                      <div>
                        <label className="label">Customer Name (Optional)</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter customer name"
                          className="input"
                        />
                      </div>
                      
                      <div>
                        <label className="label">Payment Method</label>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              value="cash"
                              checked={paymentMethod === 'cash'}
                              onChange={(e) => setPaymentMethod(e.target.value as 'cash')}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Cash</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              value="gcash"
                              checked={paymentMethod === 'gcash'}
                              onChange={(e) => setPaymentMethod(e.target.value as 'gcash')}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">GCash</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Total */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center text-lg font-semibold text-gray-900">
                      <span>Total</span>
                      <span>₱{getTotalAmount().toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={handleSubmitOrder}
                      disabled={loading}
                      className="btn btn-primary w-full"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="loading-dots">
                            <div></div>
                            <div></div>
                            <div></div>
                          </div>
                          <span className="ml-2">Processing...</span>
                        </div>
                      ) : (
                        'Place Order'
                      )}
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handlePrintReceipt}
                        disabled={items.length === 0}
                        className="btn btn-outline btn-sm"
                      >
                        <PrinterIcon className="w-4 h-4 mr-1" />
                        Print
                      </button>
                      
                      <button
                        onClick={() => {
                          clearCart();
                          setCustomerName('');
                        }}
                        disabled={items.length === 0}
                        className="btn btn-outline btn-sm"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShoppingCartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Cart is empty</p>
                  <p className="text-sm text-gray-500 mt-1">Add items from the menu to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSInterface;
