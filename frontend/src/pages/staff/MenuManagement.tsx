import React, { useEffect, useState } from 'react';
import { menuAPI } from '../../utils/api';
import { CreateCategoryForm, CreateMenuItemForm } from '../../types';
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckCircleIcon, NoSymbolIcon, ArrowUpCircleIcon, ArrowDownCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const MenuManagement: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryForm>({ name: '', description: '', display_order: 0 });
  const [itemForm, setItemForm] = useState<CreateMenuItemForm>({ name: '', description: '', category_id: 0, price: 0, image_url: '', stock_quantity: 0, low_stock_threshold: 5 });
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catRes, itemRes] = await Promise.all([
        menuAPI.getAdminCategories(),
        menuAPI.getAdminItems(),
      ]);
      setCategories(catRes.data);
      setItems(itemRes.data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      if (!categoryForm.name?.trim()) return toast.error('Category name is required');
      await menuAPI.createCategory(categoryForm);
      toast.success('Category created');
      setCategoryForm({ name: '', description: '', display_order: 0 });
      loadData();
    } catch (e:any) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: number) => {
    try {
      await menuAPI.updateCategory(id, { name: categoryForm.name, description: categoryForm.description, display_order: categoryForm.display_order });
      toast.success('Category updated');
      setEditingCategoryId(null);
      setCategoryForm({ name: '', description: '', display_order: 0 });
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const ok = window.confirm('Delete this category? This cannot be undone.');
    if (!ok) return;
    try {
      await menuAPI.deleteCategory(id);
      toast.success('Category deleted');
      loadData();
    } catch (e:any) {
      toast.error(e.response?.data?.error || 'Failed to delete category');
    }
  };

  const handleCreateItem = async () => {
    try {
      if (!itemForm.name?.trim() || !itemForm.category_id) return toast.error('Name and category are required');
      await menuAPI.createItem(itemForm);
      toast.success('Item created');
      setItemForm({ name: '', description: '', category_id: 0, price: 0, image_url: '', stock_quantity: 0, low_stock_threshold: 5 });
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create item');
    }
  };

  const handleUpdateItem = async (id: number) => {
    try {
      await menuAPI.updateItem(id, itemForm);
      toast.success('Item updated');
      setEditingItemId(null);
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (id: number) => {
    const ok = window.confirm('Delete this menu item? This cannot be undone.');
    if (!ok) return;
    try {
      await menuAPI.deleteItem(id);
      toast.success('Item deleted');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete item');
    }
  };

  const handleToggleAvailability = async (item: any) => {
    try {
      await menuAPI.updateItem(item.id, {
        name: item.name,
        description: item.description,
        category_id: item.category_id,
        price: Number(item.price),
        image_url: item.image_url,
        is_available: !item.is_available,
        stock_quantity: item.stock_quantity,
        low_stock_threshold: item.low_stock_threshold,
      });
      toast.success(!item.is_available ? 'Item marked available' : 'Item marked unavailable');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update availability');
    }
  };

  const promptQuantity = (label: string): number | null => {
    const input = window.prompt(label, '1');
    if (input === null) return null;
    const value = Number(input);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a non-negative number');
      return null;
    }
    return Math.floor(value);
  };

  const handleAdjustStock = async (item: any, action: 'set' | 'add' | 'subtract') => {
    const qty = promptQuantity(
      action === 'set' ? 'Set stock to:' : action === 'add' ? 'Add quantity:' : 'Subtract quantity:'
    );
    if (qty === null) return;
    if (action === 'subtract' && qty > Number(item.stock_quantity || 0)) {
      return toast.error('Cannot subtract more than current stock');
    }
    try {
      await menuAPI.updateStock(Number(item.id), { quantity: qty, action, notes: 'Adjusted from Menu Management' });
      toast.success('Stock updated');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update stock');
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
        <p className="mt-2 text-gray-600">Manage categories, items, and stock</p>
      </div>

      {/* Categories */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="label">Name</label>
              <input className="input" value={categoryForm.name} onChange={e=>setCategoryForm({...categoryForm, name:e.target.value})} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={categoryForm.description || ''} onChange={e=>setCategoryForm({...categoryForm, description:e.target.value})} />
            </div>
            <div>
              <label className="label">Display Order</label>
              <input type="number" className="input" value={categoryForm.display_order || 0} onChange={e=>setCategoryForm({...categoryForm, display_order: Number(e.target.value)})} />
            </div>
            <div className="flex space-x-2">
              {editingCategoryId ? (
                <button className="btn btn-primary" onClick={()=>handleUpdateCategory(editingCategoryId!)}>Update</button>
              ) : (
                <button className="btn btn-primary" onClick={handleCreateCategory}><PlusIcon className="w-4 h-4 mr-2"/>Add</button>
              )}
              {editingCategoryId && (
                <button className="btn btn-outline" onClick={()=>{setEditingCategoryId(null); setCategoryForm({ name:'', description:'', display_order:0 });}}>Cancel</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Name</th>
                  <th className="table-header-cell">Description</th>
                  <th className="table-header-cell">Order</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {categories.map((c:any)=>(
                  <tr key={c.id} className="table-row">
                    <td className="table-cell font-medium">{c.name}</td>
                    <td className="table-cell">{c.description || '-'}</td>
                    <td className="table-cell">{c.display_order}</td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-primary-600" onClick={()=>{setEditingCategoryId(c.id); setCategoryForm({ name:c.name, description:c.description, display_order:c.display_order });}}><PencilSquareIcon className="w-4 h-4"/></button>
                        <button className="p-2 text-gray-400 hover:text-danger-600" onClick={()=>handleDeleteCategory(c.id)}><TrashIcon className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Items */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Items</h2>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="label">Name</label>
              <input className="input" value={itemForm.name} onChange={e=>setItemForm({...itemForm, name:e.target.value})}/>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={itemForm.category_id} onChange={e=>setItemForm({...itemForm, category_id:Number(e.target.value)})}>
                <option value={0}>Select...</option>
                {categories.map((c:any)=>(<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <label className="label">Price</label>
              <input type="number" step="0.01" className="input" value={itemForm.price} onChange={e=>setItemForm({...itemForm, price:Number(e.target.value)})}/>
            </div>
            <div>
              <label className="label">Stock</label>
              <input type="number" className="input" value={itemForm.stock_quantity || 0} onChange={e=>setItemForm({...itemForm, stock_quantity:Number(e.target.value)})}/>
            </div>
            <div>
              <label className="label">Low Stock Threshold</label>
              <input type="number" className="input" value={itemForm.low_stock_threshold || 5} onChange={e=>setItemForm({...itemForm, low_stock_threshold:Number(e.target.value)})}/>
            </div>
            <div className="flex space-x-2">
              {editingItemId ? (
                <button className="btn btn-primary" onClick={()=>handleUpdateItem(editingItemId!)}>Update</button>
              ) : (
                <button className="btn btn-primary" onClick={handleCreateItem}><PlusIcon className="w-4 h-4 mr-2"/>Add</button>
              )}
              {editingItemId && (
                <button className="btn btn-outline" onClick={()=>{setEditingItemId(null); setItemForm({ name:'', description:'', category_id:0, price:0, image_url:'', stock_quantity:0, low_stock_threshold:5 });}}>Cancel</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Name</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell">Price</th>
                  <th className="table-header-cell">Stock</th>
                  <th className="table-header-cell">Available</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {items.map((it:any)=>(
                  <tr key={it.id} className="table-row">
                    <td className="table-cell font-medium">{it.name}</td>
                    <td className="table-cell">{it.category_name}</td>
                    <td className="table-cell">₱{Number(it.price).toFixed(2)}</td>
                    <td className="table-cell">{it.stock_quantity}</td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${it.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {it.is_available ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          className={`p-2 rounded ${it.is_available ? 'text-gray-500 hover:text-danger-600' : 'text-green-600 hover:text-green-700'}`}
                          title={it.is_available ? 'Mark unavailable' : 'Mark available'}
                          onClick={()=>handleToggleAvailability(it)}
                        >
                          {it.is_available ? <NoSymbolIcon className="w-4 h-4"/> : <CheckCircleIcon className="w-4 h-4"/>}
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-primary-600"
                          title="Add stock"
                          onClick={()=>handleAdjustStock(it, 'add')}
                        >
                          <ArrowUpCircleIcon className="w-4 h-4"/>
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-warning-600"
                          title="Subtract stock"
                          onClick={()=>handleAdjustStock(it, 'subtract')}
                        >
                          <ArrowDownCircleIcon className="w-4 h-4"/>
                        </button>
                        <button className="p-2 text-gray-400 hover:text-primary-600" onClick={()=>{setEditingItemId(it.id); setItemForm({ name:it.name, description:it.description, category_id:it.category_id, price:Number(it.price), image_url:it.image_url, stock_quantity:it.stock_quantity, low_stock_threshold:it.low_stock_threshold });}}><PencilSquareIcon className="w-4 h-4"/></button>
                        <button className="p-2 text-gray-400 hover:text-danger-600" onClick={()=>handleDeleteItem(it.id)}><TrashIcon className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuManagement;
