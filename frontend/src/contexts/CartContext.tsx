import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MenuItem, MenuItemVariant, CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity?: number, variant?: MenuItemVariant) => void;
  removeItem: (menuItemId: number, variantId?: number) => void;
  updateQuantity: (menuItemId: number, quantity: number, variantId?: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalAmount: () => number;
  getItemQuantity: (menuItemId: number, variantId?: number) => number;
  tableNumber: string | null;
  setTableNumber: (tableNumber: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState<string | null>(null);

  // Load cart and tableNumber from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    const savedTableNumber = localStorage.getItem('tableNumber');

    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setItems(parsedCart);
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        localStorage.removeItem('cart');
      }
    }

    if (savedTableNumber) {
      setTableNumber(savedTableNumber);
    }
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // Save tableNumber to localStorage whenever it changes
  useEffect(() => {
    if (tableNumber) {
      localStorage.setItem('tableNumber', tableNumber);
    } else {
      localStorage.removeItem('tableNumber');
    }
  }, [tableNumber]);

  // Add item to cart
  const addItem = (menuItem: MenuItem, quantity: number = 1, variant?: MenuItemVariant) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.menu_item.id === menuItem.id && (item.variant?.id || 0) === (variant?.id || 0));

      if (existingItem) {
        // Update existing item quantity
        return prevItems.map(item =>
          item.menu_item.id === menuItem.id && (item.variant?.id || 0) === (variant?.id || 0)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item
        return [...prevItems, { menu_item: menuItem, variant, quantity }];
      }
    });
  };

  // Remove item from cart
  const removeItem = (menuItemId: number, variantId?: number) => {
    setItems(prevItems =>
      prevItems.filter(item => !(item.menu_item.id === menuItemId && (item.variant?.id || 0) === (variantId || 0)))
    );
  };

  // Update item quantity
  const updateQuantity = (menuItemId: number, quantity: number, variantId?: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId, variantId);
      return;
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.menu_item.id === menuItemId && (item.variant?.id || 0) === (variantId || 0)
          ? { ...item, quantity }
          : item
      )
    );
  };

  // Clear all items from cart
  const clearCart = () => {
    setItems([]);
    localStorage.removeItem('cart');
  };

  // Get total number of items
  const getTotalItems = (): number => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  // Get total amount
  const getTotalAmount = (): number => {
    return items.reduce((total, item) => total + ((item.variant?.price ?? item.menu_item.price) * item.quantity), 0);
  };

  // Get quantity of specific item
  const getItemQuantity = (menuItemId: number, variantId?: number): number => {
    const item = items.find(item => item.menu_item.id === menuItemId && (item.variant?.id || 0) === (variantId || 0));
    return item ? item.quantity : 0;
  };

  const value: CartContextType = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalAmount,
    getItemQuantity,
    tableNumber,
    setTableNumber,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

// Custom hook to use cart context
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;
