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
  BanknotesIcon,
  CalculatorIcon,
  UserGroupIcon,
  CheckBadgeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../../utils/api';

const POSInterface: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { items, addItem, updateQuantity, removeItem, getTotalAmount, clearCart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [loading, setLoading] = useState(false);

  // New state for Order Processing
  const [currentOrder, setCurrentOrder] = useState<any | null>(null);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Manager Auth for Discount
  const [showManagerAuth, setShowManagerAuth] = useState(false);
  const [managerCreds, setManagerCreds] = useState({ username: '', password: '' });
  const [isVerifying, setIsVerifying] = useState(false);

  // VAT Toggle
  const [applyVat, setApplyVat] = useState(true); // Default to applying VAT

  // Size Selection Modal
  const [itemToSelectSize, setItemToSelectSize] = useState<MenuItem | null>(null);

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
      const loadedItems = itemsResponse.data;
      setMenuItems(loadedItems);

      // Check for redirected order
      if (location.state?.orderId) {
        await loadOrderToEdit(location.state.orderId, loadedItems);
      }
    } catch (error) {
      console.error('Error loading menu data:', error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const loadOrderToEdit = async (orderId: number, currentMenuItems: MenuItem[]) => {
    try {
      const { data: order } = await ordersAPI.getById(orderId);
      setCurrentOrder(order);
      setCustomerName(order.customer_name || '');
      setPaymentMethod(order.payment_method || 'cash');

      // Clear current cart and populate
      clearCart();

      if (order.items) {
        order.items.forEach((orderItem: any) => {
          const menuItem = currentMenuItems.find(i => i.id === orderItem.menu_item_id);
          if (menuItem) {
            // Find variant if any
            const variant = menuItem.variants?.find(v => v.id === orderItem.menu_item_variant_id);
            addItem(menuItem, orderItem.quantity, variant);
          }
        });
      }
    } catch (err) {
      console.error("Failed to load order", err);
      toast.error("Failed to load order details");
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === null || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch && item.is_available;
  });

  const handleAddToCart = (item: MenuItem) => {
    // If item has variants
    if (item.variants && item.variants.length > 0) {
      // If ONLY one variant (e.g. 8oz only), select it automatically
      if (item.variants.length === 1) {
        const variant = item.variants[0];
        addItem(item, 1, variant);
        toast.success(`${item.name} (${variant.size_label || variant.variant_name}) added to cart`);
        return;
      }

      // Otherwise open selection modal
      setItemToSelectSize(item);
      return;
    }

    // Otherwise add normally
    addItem(item, 1);
    toast.success(`${item.name} added to cart`);
  };

  const handleVariantSelection = (variant: MenuItemVariant) => {
    if (!itemToSelectSize) return;

    addItem(itemToSelectSize, 1, variant);
    toast.success(`${itemToSelectSize.name} (${variant.size_label || variant.variant_name}) added to cart`);
    setItemToSelectSize(null);
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

  const getFinalTotal = () => {
    const subtotal = getTotalAmount();
    if (discountApplied) {
      // PWD Discount: 20% on all items (for MVP simplicity) or specific logic.
      // Standard: 20% + VAT Exemption usually. 
      // Let's implement 20% flat for now as requested "PWD discount".
      const discount = subtotal * 0.20;
      return subtotal - discount;
    }
    return subtotal;
  };

  const getVatCalculations = () => {
    const finalTotal = getFinalTotal();
    // Assuming 12% VAT
    const taxRate = 0.12;
    if (!applyVat) {
      return { vatable: 0, vat: 0 };
    }
    const vatable = finalTotal / (1 + taxRate);
    const vat = finalTotal - vatable;
    return { vatable, vat };
  };

  const handleApplyDiscount = () => {
    if (discountApplied) {
      setDiscountApplied(false);
      setDiscountAmount(0);
      return;
    }
    setShowManagerAuth(true);
  };

  const handleManagerVerification = async () => {
    if (!managerCreds.username || !managerCreds.password) {
      toast.error("Please enter credentials");
      return;
    }
    setIsVerifying(true);
    try {
      await authAPI.verifyRole({
        username: managerCreds.username,
        password: managerCreds.password,
        requiredRole: 'manager' // verify checks for manager/admin/owner
      });

      setDiscountApplied(true);
      setShowManagerAuth(false);
      setManagerCreds({ username: '', password: '' });
      toast.success("Manager authorized. Discount applied.");
    } catch (err) {
      toast.error("Authorization failed");
    } finally {
      setIsVerifying(false);
    }
  };

  // Shop Info for Receipt
  const [shopInfo, setShopInfo] = useState<any>(null);

  useEffect(() => {
    const fetchShopInfo = async () => {
      try {
        const { settingsAPI } = await import('../../utils/api');
        const response = await settingsAPI.getShopInfo();
        setShopInfo(response.data);
      } catch (e) {
        // ignore
      }
    };
    fetchShopInfo();
  }, []);

  const formatMoney = (value: number) => `₱${value.toFixed(2)}`;

  const buildReceiptHTML = (order: any) => {
    const businessName = shopInfo?.shop_name || 'Orijins Coffee House';
    const address = shopInfo?.shop_address || '';
    const phone = shopInfo?.shop_phone || '';
    const dateObj = order.created_at ? new Date(order.created_at) : new Date();
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString();

    const itemsList = order.items || items.map(i => ({
      quantity: i.quantity,
      menu_item_name: i.menu_item.name,
      unit_price: i.variant?.price || i.menu_item.price,
      total_price: (i.variant?.price || i.menu_item.price) * i.quantity
    }));

    const itemsRows = itemsList.map((it: any) => `
        <tr>
          <td style="text-align:left">${Number(it.quantity).toFixed(1)} x</td>
          <td style="text-align:left">${it.menu_item_name || it.variant_name || 'Item'}</td>
          <td style="text-align:right">${Number(it.unit_price).toFixed(2)}</td>
          <td style="text-align:right">${Number(it.total_price).toFixed(2)}</td>
        </tr>`
    )
      .join('');

    const totalAmount = Number(order.total_amount || 0);
    const subtotal = totalAmount + (order.discount_amount || 0);
    const showDiscount = (order.discount_amount || 0) > 0;

    return `<!doctype html><html><head><meta charset="utf-8" />
      <title>Receipt ${order.order_number}</title>
      <style>
        body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; margin: 0; }
        .receipt { width: 260px; padding: 12px; }
        h1 { font-size: 16px; margin: 0 0 4px 0; text-align:center; }
        .center { text-align:center; font-size:12px; }
        .muted { color:#444; }
        .sep { border-top:1px dashed #000; margin:8px 0; }
        table { width:100%; font-size:12px; border-collapse:collapse; }
        td { padding:2px 0; }
        .totals td { font-weight:bold; }
        @media print { .no-print { display:none } }
      </style>
    </head>
    <body onload="window.print(); setTimeout(()=>window.close(), 300);">
      <div class="receipt">
        <h1>${businessName}</h1>
        <div class="center muted">${address}</div>
        <div class="center muted">${phone}</div>
        <div class="sep"></div>
        <div style="font-size:12px">
          <div>INV#: <strong>${order.order_number || 'PENDING'}</strong></div>
          <div>DATE: ${dateStr} &nbsp;&nbsp; TIME: ${timeStr}</div>
        </div>
        <div class="sep"></div>
        <table>
          ${itemsRows}
        </table>
        <div class="sep"></div>
        <table class="totals">
          <tr><td style="text-align:left">SUBTOTAL</td><td style="text-align:right">${formatMoney(showDiscount ? subtotal : totalAmount)}</td></tr>
          ${showDiscount ? `<tr><td style="text-align:left">DISCOUNT</td><td style="text-align:right">-${formatMoney(order.discount_amount)}</td></tr>` : ''}
          ${order.is_vat_applied ? `
          <tr><td style="text-align:left" class="muted">VATable Sales</td><td style="text-align:right" class="muted">${formatMoney(order.vatable_sales || 0)}</td></tr>
          <tr><td style="text-align:left" class="muted">VAT (12%)</td><td style="text-align:right" class="muted">${formatMoney(order.vat_amount || 0)}</td></tr>
          ` : ''}
          <tr><td style="text-align:left">TOTAL</td><td style="text-align:right">${formatMoney(totalAmount)}</td></tr>
        </table>
        <div class="sep"></div>
        <div style="font-size:12px">
          <div>PAYMENT RECEIVED: <strong>${formatMoney(order.cash_received || totalAmount)}</strong></div>
          <div class="muted">${(order.payment_method || 'cash').toUpperCase()}</div>
          <div>CHANGE AMOUNT: ${formatMoney(order.change_amount || 0)}</div>
        </div>
        <div class="sep"></div>
        <div class="center">Acknowledgement Receipt<br/>Thank you!</div>
      </div>
    </body></html>`;
  };

  const handlePrintReceipt = (order: any) => {
    try {
      const html = buildReceiptHTML(order);
      const win = window.open('', 'printwindow', 'width=320,height=600');
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (_) {
      toast.error('Unable to print');
    }
  };

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const finalTotal = getFinalTotal();
    const subtotal = getTotalAmount();
    const discount = subtotal - finalTotal;

    if (paymentMethod === 'cash' && cashReceived < finalTotal) {
      toast.error(`Insufficient cash. Needed: ₱${finalTotal.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      // Common payload data
      const commonData = {
        discount_amount: discountApplied ? discount : 0,
        cash_received: paymentMethod === 'cash' ? cashReceived : 0,
        change_amount: paymentMethod === 'cash' ? (cashReceived - finalTotal) : 0,
        payment_method: paymentMethod,
        total_amount: finalTotal,
        status: 'in_progress', // As requested: POS orders start as processing
        is_vat_applied: applyVat
      };

      if (currentOrder) {
        // FOR EXISTING ORDERS (e.g. redirected from Order Mgmt)
        // Flow: Update Status/Payment -> Print Receipt -> Navigate

        // 1. Update Order
        const { default: api } = await import('../../utils/api');
        await api.patch(`/orders/${currentOrder.id}/status`, commonData);

        // 2. Print Receipt
        // Create updated order object for printing
        const updatedOrder = {
          ...currentOrder,
          ...commonData
        };
        handlePrintReceipt(updatedOrder);

        toast.success('Order processed successfully!');
        navigate('/staff/orders');
      } else {
        // FOR NEW ORDERS
        // Flow: Create (Processing) -> Print Receipt -> Navigate

        const orderData = {
          items: items.map(item => ({
            menu_item_id: item.menu_item.id,
            menu_item_variant_id: item.variant?.id,
            quantity: item.quantity,
          })),
          customer_name: customerName.trim() || null,
          ...commonData
        };

        const response = await ordersAPI.create(orderData);

        if (response.data.order) {
          // Print Receipt
          handlePrintReceipt(response.data.order);

          clearCart();
          setCustomerName('');
          setCashReceived(0);
          setDiscountApplied(false);
          setApplyVat(true); // Reset VAT to default after order
          toast.success('Order placed successfully!');
          navigate('/staff/orders'); // Navigate away after placing
        }
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
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${selectedCategory === null
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
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${selectedCategory === category.id
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

                  {/* Payment Details */}
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <h3 className="font-semibold text-gray-900 flex items-center mb-4">
                      <BanknotesIcon className="w-5 h-5 mr-2" />
                      Payment Details
                    </h3>

                    {/* VAT Toggle */}
                    <div className="flex items-center justify-between mt-2">
                      <label className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={applyVat}
                          onChange={(e) => setApplyVat(e.target.checked)}
                          className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                        />
                        Issue VAT Receipt
                      </label>
                    </div>

                    {/* Discount Toggle */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">PWD/Senior Discount (20%)</span>
                      <button
                        onClick={handleApplyDiscount}
                        className={`btn btn-sm ${discountApplied ? 'btn-danger' : 'btn-outline'}`}
                      >
                        {discountApplied ? 'Remove' : 'Apply'}
                      </button>
                    </div>

                    {/* Total Calculation */}
                    <div className="space-y-1 text-sm pt-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span>
                        <span>₱{getTotalAmount().toFixed(2)}</span>
                      </div>
                      {discountApplied && (
                        <div className="flex justify-between text-success-600 font-medium">
                          <span>Discount (PWD/Senior)</span>
                          <span>-₱{(getTotalAmount() - getFinalTotal()).toFixed(2)}</span>
                        </div>
                      )}

                      {applyVat && (
                        <>
                          <div className="flex justify-between text-gray-500 text-xs mt-1">
                            <span>VATable Sales</span>
                            <span>₱{getVatCalculations().vatable.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-500 text-xs">
                            <span>VAT (12%)</span>
                            <span>₱{getVatCalculations().vat.toFixed(2)}</span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between items-center text-xl font-bold text-gray-900 pt-2 border-t mt-2">
                        <span>Total Due</span>
                        <span>₱{getFinalTotal().toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Payment Inputs */}
                    {paymentMethod === 'cash' && (
                      <div className="space-y-2 pt-2">
                        <label className="label text-xs">Cash Received</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={cashReceived || ''}
                            onChange={(e) => setCashReceived(parseFloat(e.target.value))}
                            className="input w-full pr-16"
                            placeholder="0.00"
                            min="0"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                            PHP
                          </div>
                        </div>

                        {/* Change Display */}
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                          <span className="text-gray-600 font-medium">Change</span>
                          <span className={`font-bold text-lg ${cashReceived >= getFinalTotal() ? 'text-success-600' : 'text-gray-400'}`}>
                            ₱{Math.max(0, cashReceived - getFinalTotal()).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={handleSubmitOrder}
                      disabled={loading || (paymentMethod === 'cash' && cashReceived < getFinalTotal())}
                      className={`btn w-full ${currentOrder ? 'btn-success' : 'btn-primary'}`}
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
                        currentOrder ? 'Complete Order' : 'Place Order'
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
                          setCurrentOrder(null);
                          setCashReceived(0);
                          setDiscountApplied(false);
                          // If current order was loaded, maybe navigate back?
                          if (currentOrder) navigate('/staff/orders');
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        {currentOrder ? 'Cancel Edit' : 'Clear'}
                      </button>
                    </div>
                  </div>

                  {/* Manager Auth Modal */}
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

      {/* Manager Auth Modal */}
      {showManagerAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <UserGroupIcon className="w-5 h-5 mr-2 text-primary-600" />
              Manager Authorization
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please enter manager credentials to approve PWD discount.
            </p>

            <div className="space-y-3">
              <div>
                <label className="label text-xs">Username</label>
                <input
                  type="text"
                  className="input w-full"
                  value={managerCreds.username}
                  onChange={(e) => setManagerCreds({ ...managerCreds, username: e.target.value })}
                />
              </div>
              <div>
                <label className="label text-xs">Password</label>
                <input
                  type="password"
                  className="input w-full"
                  value={managerCreds.password}
                  onChange={(e) => setManagerCreds({ ...managerCreds, password: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowManagerAuth(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleManagerVerification}
                disabled={isVerifying}
                className="btn btn-primary btn-sm"
              >
                {isVerifying ? 'Verifying...' : 'Authorize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Size Selection Modal */}
      {itemToSelectSize && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Select Size</h3>
            <p className="text-gray-600 mb-4">
              Choose a size for <span className="font-semibold">{itemToSelectSize.name}</span>
            </p>

            <div className="grid grid-cols-1 gap-3">
              {itemToSelectSize.variants?.sort((a, b) => a.price - b.price).map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => handleVariantSelection(variant)}
                  className="btn btn-outline py-3 flex justify-between items-center hover:bg-primary-50 hover:border-primary-500 hover:text-primary-700"
                >
                  <span className="font-semibold text-lg">{variant.size_label || variant.variant_name}</span>
                  <span className="font-bold">₱{variant.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setItemToSelectSize(null)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSInterface;
