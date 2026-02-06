import React, { useState, useEffect } from 'react';
import { Category, MenuItem, MenuItemVariant } from '../../types';
import { menuAPI } from '../../utils/api';
import { useCart } from '../../contexts/CartContext';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ... imports remain the same

// Sub-component for individual menu items to handle variant state
const MenuItemCard: React.FC<{ item: MenuItem }> = ({ item }) => {
  const { addItem, getItemQuantity, updateQuantity } = useCart();

  // Initialize with the first variant (usually smallest/cheapest) if variants exist
  // Sort variants by price just in case
  const sortedVariants = item.variants?.sort((a, b) => a.price - b.price);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | undefined>(
    sortedVariants && sortedVariants.length > 0 ? sortedVariants[0] : undefined
  );

  const quantity = getItemQuantity(item.id, selectedVariant?.id);
  const isInCart = quantity > 0;

  // Determine display price
  const displayPrice = selectedVariant ? selectedVariant.price : item.price;

  const handleAddToCart = () => {
    addItem(item, 1, selectedVariant);
    const label = selectedVariant?.size_label || selectedVariant?.variant_name;
    toast.success(`${item.name}${label ? ` (${label})` : ''} added to cart`);
  };

  const handleUpdateQuantity = (change: number) => {
    const newQuantity = quantity + change;
    if (newQuantity <= 0) {
      // For remove, we need to pass the variantId if it exists
      // The context removeItem signature is (menuItemId, variantId)
      // define helper or use context directly. 
      // Context updateQuantity handles removal if qty <= 0 ? 
      // Let's check context: updateQuantity(id, qty, varId) -> if qty<=0 removeItem.
      updateQuantity(item.id, 0, selectedVariant?.id);
    } else {
      updateQuantity(item.id, newQuantity, selectedVariant?.id);
    }
  };

  return (
    <div className="card hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col h-full">
      {/* Item Image */}
      <div className="h-48 bg-gray-200 flex items-center justify-center relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-6xl text-gray-400">☕</div>
        )}
        {/* Out of stock overlay could go here if needed, but we check is_available generally */}
      </div>

      {/* Item Details */}
      <div className="card-body flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{item.name}</h3>
          <span className="text-lg font-bold text-primary-600 whitespace-nowrap ml-2">
            ₱{displayPrice.toFixed(2)}
          </span>
        </div>

        {item.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-grow">
            {item.description}
          </p>
        )}

        {/* Variant/Size Selector */}
        {sortedVariants && sortedVariants.length > 0 && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Select Size
            </label>
            <div className="flex flex-wrap gap-2">
              {sortedVariants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  className={`px-3 py-1 text-sm rounded-full border transition-all ${selectedVariant?.id === variant.id
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                    }`}
                >
                  {variant.size_label || variant.variant_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity Controls */}
        <div className="mt-auto">
          {!isInCart ? (
            <button
              onClick={handleAddToCart}
              className="btn btn-primary w-full"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add to Cart
            </button>
          ) : (
            <div className="flex items-center space-x-3 w-full">
              <button
                onClick={() => handleUpdateQuantity(-1)}
                className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200"
              >
                <MinusIcon className="w-4 h-4" />
              </button>
              <span className="flex-1 text-center font-medium">
                {quantity} in cart
              </span>
              <button
                onClick={() => handleUpdateQuantity(1)}
                className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CustomerMenu: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

      {/* Menu Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
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
