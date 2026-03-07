import React, { useEffect, useState } from 'react';
import { menuAPI } from '../../utils/api';
import { CreateCategoryForm, CreateMenuItemForm } from '../../types';
import { PlusIcon, PencilSquareIcon, TrashIcon, CheckCircleIcon, NoSymbolIcon, ArrowUpCircleIcon, ArrowDownCircleIcon, PhotoIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `http://localhost:5000${path}`;
};

const MenuManagement: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryForm>({ name: '', description: '', display_order: 0 });
  const [itemForm, setItemForm] = useState<CreateMenuItemForm>({ name: '', description: '', category_id: 0, price: 0, image_url: '' });
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  const [showCropModal, setShowCropModal] = useState(false);
  const [imageThumbnail, setImageThumbnail] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result), false);
        reader.readAsDataURL(file);
      });
      setImageThumbnail(imageDataUrl as string);
      setShowCropModal(true);
      e.target.value = '';
    }
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropSave = async () => {
    try {
      if (!imageThumbnail || !croppedAreaPixels) return;
      setIsUploading(true);
      const croppedImageBlob = await getCroppedImg(imageThumbnail, croppedAreaPixels, 0);
      if (!croppedImageBlob) throw new Error('Failed to crop image');
      
      const file = new File([croppedImageBlob], 'cropped-image.jpg', { type: 'image/jpeg' });
      const res = await (menuAPI as any).uploadImage(file, file.name);
      
      setItemForm({ ...itemForm, image_url: res.data.url });
      setShowCropModal(false);
      setImageThumbnail(null);
      toast.success('Image processed successfully');
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

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
    } catch (e: any) {
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
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to delete category');
    }
  };

  const handleCreateItem = async () => {
    try {
      if (!itemForm.name?.trim() || !itemForm.category_id) return toast.error('Name and category are required');
      await menuAPI.createItem(itemForm);
      toast.success('Item created');
      setItemForm({ name: '', description: '', category_id: 0, price: 0, image_url: '' });
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
              <input className="input" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={categoryForm.description || ''} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Display Order</label>
              <input type="number" className="input" value={categoryForm.display_order || 0} onChange={e => setCategoryForm({ ...categoryForm, display_order: Number(e.target.value) })} />
            </div>
            <div className="flex space-x-2">
              {editingCategoryId ? (
                <button className="btn btn-primary" onClick={() => handleUpdateCategory(editingCategoryId!)}>Update</button>
              ) : (
                <button className="btn btn-primary" onClick={handleCreateCategory}><PlusIcon className="w-4 h-4 mr-2" />Add</button>
              )}
              {editingCategoryId && (
                <button className="btn btn-outline" onClick={() => { setEditingCategoryId(null); setCategoryForm({ name: '', description: '', display_order: 0 }); }}>Cancel</button>
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
                {categories.map((c: any) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell font-medium">{c.name}</td>
                    <td className="table-cell">{c.description || '-'}</td>
                    <td className="table-cell">{c.display_order}</td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-gray-400 hover:text-primary-600" onClick={() => { setEditingCategoryId(c.id); setCategoryForm({ name: c.name, description: c.description, display_order: c.display_order }); }}><PencilSquareIcon className="w-4 h-4" /></button>
                        <button className="p-2 text-gray-400 hover:text-danger-600" onClick={() => handleDeleteCategory(c.id)}><TrashIcon className="w-4 h-4" /></button>
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
              <input className="input" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={itemForm.category_id} onChange={e => setItemForm({ ...itemForm, category_id: Number(e.target.value) })}>
                <option value={0}>Select...</option>
                {categories.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <label className="label">Price</label>
              <input type="number" step="0.01" className="input" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: Number(e.target.value) })} />
            </div>

            <div className="md:col-span-2">
              <label className="label">Photo</label>
              <div className="flex items-center space-x-2 h-10">
                {itemForm.image_url && (
                   <img src={getImageUrl(itemForm.image_url)} alt="preview" className="h-10 w-10 object-cover rounded border" />
                )}
                <label className="btn btn-outline cursor-pointer px-3 py-2 text-sm bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50 flex items-center h-full">
                  <PhotoIcon className="w-4 h-4 mr-2" />
                  {itemForm.image_url ? 'Replace Photo' : 'Attach Photo'}
                  <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                </label>
              </div>
            </div>

            <div className="flex space-x-2">
              {editingItemId ? (
                <button className="btn btn-primary" onClick={() => handleUpdateItem(editingItemId!)}>Update</button>
              ) : (
                <button className="btn btn-primary" onClick={handleCreateItem}><PlusIcon className="w-4 h-4 mr-2" />Add</button>
              )}
              {editingItemId && (
                <button className="btn btn-outline" onClick={() => { setEditingItemId(null); setItemForm({ name: '', description: '', category_id: 0, price: 0, image_url: '' }); }}>Cancel</button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Photo</th>
                  <th className="table-header-cell">Name</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell">Price</th>
                  <th className="table-header-cell">Available</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {items.map((it: any) => (
                  <tr key={it.id} className="table-row">
                    <td className="table-cell">
                      {it.image_url ? (
                        <img src={getImageUrl(it.image_url)} alt={it.name} className="w-10 h-10 object-cover rounded border bg-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs border">No img</div>
                      )}
                    </td>
                    <td className="table-cell font-medium">{it.name}</td>
                    <td className="table-cell">{it.category_name}</td>
                    <td className="table-cell">₱{Number(it.price).toFixed(2)}</td>

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
                          onClick={() => handleToggleAvailability(it)}
                        >
                          {it.is_available ? <NoSymbolIcon className="w-4 h-4" /> : <CheckCircleIcon className="w-4 h-4" />}
                        </button>
                        <button className="p-2 text-gray-400 hover:text-primary-600" onClick={() => { setEditingItemId(it.id); setItemForm({ name: it.name, description: it.description, category_id: it.category_id, price: Number(it.price), image_url: it.image_url }); }}><PencilSquareIcon className="w-4 h-4" /></button>
                        <button className="p-2 text-gray-400 hover:text-danger-600" onClick={() => handleDeleteItem(it.id)}><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-gray-900 border-b pb-2">Crop Photo</h3>
            <div className="relative h-64 w-full bg-gray-100 mb-6 rounded overflow-hidden">
              {imageThumbnail && (
                <Cropper
                  image={imageThumbnail}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              )}
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 block mb-2">Zoom</label>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                className="btn btn-outline"
                disabled={isUploading}
                onClick={() => { setShowCropModal(false); setImageThumbnail(null); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary min-w-[120px]"
                onClick={handleCropSave}
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin mr-2"></div>
                    Uploading
                  </div>
                ) : 'Save & Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
