import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../utils/api';
import { PlusIcon, TrashIcon, PencilIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface InventoryItem {
    id: number;
    name: string;
    sku: string;
    category: string;
    stock_quantity: string; // comes as string from decimal
    unit: string;
    low_stock_threshold: string;
    cost_per_unit: string;
    updated_at: string;
}

const Inventory: React.FC = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [stockItem, setStockItem] = useState<InventoryItem | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '',
        stock_quantity: 0,
        unit: 'unit',
        low_stock_threshold: 10,
        cost_per_unit: 0
    });

    const [stockData, setStockData] = useState({
        quantity: 0,
        action: 'add',
        notes: ''
    });

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        try {
            setLoading(true);
            const response = await inventoryAPI.getAll();
            setItems(response.data);
        } catch (error) {
            console.error('Error loading inventory:', error);
            toast.error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await inventoryAPI.update(editingItem.id, formData);
                toast.success('Item updated successfully');
            } else {
                await inventoryAPI.create(formData);
                toast.success('Item created successfully');
            }
            setShowModal(false);
            resetForm();
            loadInventory();
        } catch (error) {
            console.error('Error saving item:', error);
            toast.error('Failed to save item');
        }
    };

    const handleStockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockItem) return;

        try {
            await inventoryAPI.updateStock(stockItem.id, stockData);
            toast.success('Stock updated successfully');
            setShowStockModal(false);
            setStockData({ quantity: 0, action: 'add', notes: '' });
            loadInventory();
        } catch (error) {
            console.error('Error updating stock:', error);
            toast.error('Failed to update stock');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await inventoryAPI.delete(id);
            toast.success('Item deleted successfully');
            loadInventory();
        } catch (error) {
            console.error('Error deleting item:', error);
            toast.error('Failed to delete item. It might be linked to recipes.');
        }
    };

    const openEditModal = (item: InventoryItem) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            sku: item.sku || '',
            category: item.category || '',
            stock_quantity: Number(item.stock_quantity),
            unit: item.unit || 'unit',
            low_stock_threshold: Number(item.low_stock_threshold),
            cost_per_unit: Number(item.cost_per_unit)
        });
        setShowModal(true);
    };

    const openStockModal = (item: InventoryItem) => {
        setStockItem(item);
        setStockData({ quantity: 0, action: 'add', notes: '' });
        setShowStockModal(true);
    };

    const resetForm = () => {
        setEditingItem(null);
        setFormData({
            name: '',
            sku: '',
            category: '',
            stock_quantity: 0,
            unit: 'unit',
            low_stock_threshold: 10,
            cost_per_unit: 0
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    Add Item
                </button>
            </div>

            {/* Inventory Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Level</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/Unit</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-4">No inventory items found</td></tr>
                            ) : (
                                items.map((item) => {
                                    const stock = Number(item.stock_quantity);
                                    const threshold = Number(item.low_stock_threshold);
                                    const isLowStock = stock <= threshold;
                                    const isOutOfStock = stock === 0;

                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                                <div className="text-sm text-gray-500">{item.sku}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {item.category || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${isOutOfStock ? 'bg-red-100 text-red-800' : isLowStock ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                        {stock} {item.unit}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">Threshold: {threshold}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                ₱{Number(item.cost_per_unit).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => openStockModal(item)}
                                                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                    title="Update Stock"
                                                >
                                                    <ArrowPathIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="text-blue-600 hover:text-blue-900 mr-4"
                                                >
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{editingItem ? 'Edit Item' : 'New Inventory Item'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="input-field mt-1 block w-full"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Category</label>
                                    <input
                                        type="text"
                                        className="input-field mt-1 block w-full"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Unit</label>
                                    <input
                                        type="text"
                                        className="input-field mt-1 block w-full"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        placeholder="pcs, kg, etc."
                                    />
                                </div>
                            </div>

                            {!editingItem && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Initial Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="input-field mt-1 block w-full"
                                        value={formData.stock_quantity}
                                        onChange={(e) => setFormData({ ...formData, stock_quantity: parseFloat(e.target.value) })}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Low Stock Alert</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="input-field mt-1 block w-full"
                                        value={formData.low_stock_threshold}
                                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cost per Unit</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="input-field mt-1 block w-full"
                                        value={formData.cost_per_unit}
                                        onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-4 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock Update Modal */}
            {showStockModal && stockItem && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Update Stock: {stockItem.name}</h2>
                        <form onSubmit={handleStockSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Action</label>
                                <select
                                    className="input-field mt-1 block w-full"
                                    value={stockData.action}
                                    onChange={(e) => setStockData({ ...stockData, action: e.target.value })}
                                >
                                    <option value="add">Add (Restock)</option>
                                    <option value="subtract">Subtract (Adjustment)</option>
                                    <option value="set">Set Exact Count</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="input-field mt-1 block w-full"
                                    value={stockData.quantity}
                                    onChange={(e) => setStockData({ ...stockData, quantity: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                                <textarea
                                    className="input-field mt-1 block w-full"
                                    rows={3}
                                    value={stockData.notes}
                                    onChange={(e) => setStockData({ ...stockData, notes: e.target.value })}
                                    placeholder="Reason for adjustment..."
                                />
                            </div>

                            <div className="flex justify-end gap-4 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowStockModal(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Update Stock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Inventory;
