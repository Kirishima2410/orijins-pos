import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MenuItem, CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity?: number) => void;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalAmount: () => number;
  getItemQuantity: (menuItemId: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setItems(parsedCart);
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        localStorage.removeItem('cart');
      }
    }
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  // Add item to cart
  const addItem = (menuItem: MenuItem, quantity: number = 1) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.menu_item.id === menuItem.id);
      
      if (existingItem) {
        // Update existing item quantity
        return prevItems.map(item =>
          item.menu_item.id === menuItem.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item
        return [...prevItems, { menu_item: menuItem, quantity }];
      }
    });
  };

  // Remove item from cart
  const removeItem = (menuItemId: number) => {
    setItems(prevItems => 
      prevItems.filter(item => item.menu_item.id !== menuItemId)
    );
  };

  // Update item quantity
  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }

    setItems(prevItems =>
      prevItems.map(item =>
        item.menu_item.id === menuItemId
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
    return items.reduce((total, item) => total + (item.menu_item.price * item.quantity), 0);
  };

  // Get quantity of specific item
  const getItemQuantity = (menuItemId: number): number => {
    const item = items.find(item => item.menu_item.id === menuItemId);
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
