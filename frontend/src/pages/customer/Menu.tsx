import React, { useState, useEffect } from 'react';
import { Category, MenuItem } from '../../types';
import { menuAPI } from '../../utils/api';
import { useCart } from '../../contexts/CartContext';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CustomerMenu: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { addItem, getItemQuantity, updateQuantity } = useCart();

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
    return matchesCategory && matchesSearch;
  });

  const handleAddToCart = (item: MenuItem) => {
    addItem(item, 1);
    toast.success(`${item.name} added to cart`);
  };

  const handleQuantityChange = (item: MenuItem, change: number) => {
    const currentQuantity = getItemQuantity(item.id);
    const newQuantity = currentQuantity + change;
    
    if (newQuantity <= 0) {
      updateQuantity(item.id, 0);
    } else {
      updateQuantity(item.id, newQuantity);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Menu</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Discover our carefully crafted selection of coffee, tea, pastries, and more. 
          Made fresh daily with premium ingredients.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="w-full lg:w-96">
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input w-full"
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

      {/* Menu Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const quantity = getItemQuantity(item.id);
          const isInCart = quantity > 0;

          return (
            <div
              key={item.id}
              className="card hover:shadow-md transition-shadow duration-200 overflow-hidden"
            >
              {/* Item Image */}
              <div className="h-48 bg-gray-200 flex items-center justify-center">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-6xl text-gray-400">☕</div>
                )}
              </div>

              {/* Item Details */}
              <div className="card-body">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                  <span className="text-lg font-bold text-primary-600">
                    ₱{item.price.toFixed(2)}
                  </span>
                </div>

                {item.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {item.description}
                  </p>
                )}

                {/* Stock Status */}
                {item.stock_quantity <= 0 ? (
                  <div className="badge badge-danger mb-4">Out of Stock</div>
                ) : item.stock_quantity <= item.low_stock_threshold ? (
                  <div className="badge badge-warning mb-4">Limited Stock</div>
                ) : null}

                {/* Quantity Controls */}
                {item.stock_quantity > 0 ? (
                  <div className="flex items-center justify-between">
                    {!isInCart ? (
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="btn btn-primary w-full"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Add to Cart
                      </button>
                    ) : (
                      <div className="flex items-center space-x-3 w-full">
                        <button
                          onClick={() => handleQuantityChange(item, -1)}
                          className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200"
                        >
                          <MinusIcon className="w-4 h-4" />
                        </button>
                        <span className="flex-1 text-center font-medium">
                          {quantity} in cart
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item, 1)}
                          className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    disabled
                    className="btn btn-secondary w-full opacity-50 cursor-not-allowed"
                  >
                    Out of Stock
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl text-gray-300 mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
          <p className="text-gray-600">
            {searchTerm
              ? `No items match your search for "${searchTerm}"`
              : 'No items available in this category'}
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory(null);
            }}
            className="btn btn-primary mt-4"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
