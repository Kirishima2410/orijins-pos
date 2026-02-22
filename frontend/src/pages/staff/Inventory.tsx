import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface InventoryItem {
    id: number;
    item_code: string;
    description: string;
    category: string;
    display_order: number;
}

interface InventoryEntry {
    item_id: number;
    beg_bal: number;
    delivery: number;
    usage_amount: number;
    waste: number;
    end_bal: number;
}

const Inventory: React.FC = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [entries, setEntries] = useState<Record<number, InventoryEntry>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Header Info
    const [sheetDate, setSheetDate] = useState(new Date().toISOString().split('T')[0]);
    const [department, setDepartment] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [itemsRes, balancesRes] = await Promise.all([
                inventoryAPI.getItems(),
                inventoryAPI.getLatestBalances()
            ]);

            const fetchedItems = itemsRes.data as InventoryItem[];
            const latestBalances = balancesRes.data as Record<number, number>;

            setItems(fetchedItems);

            // Initialize entries
            const initialEntries: Record<number, InventoryEntry> = {};
            fetchedItems.forEach(item => {
                const begBal = latestBalances[item.id] || 0;
                initialEntries[item.id] = {
                    item_id: item.id,
                    beg_bal: begBal,
                    delivery: 0,
                    usage_amount: 0,
                    waste: 0,
                    end_bal: begBal // initially end_bal = beg_bal
                };
            });

            setEntries(initialEntries);
        } catch (error) {
            console.error('Error loading inventory data:', error);
            toast.error('Failed to load inventory data');
        } finally {
            setLoading(false);
        }
    };

    const handleEntryChange = (itemId: number, field: keyof InventoryEntry, value: string) => {
        const numValue = parseFloat(value) || 0;

        setEntries(prev => {
            const currentEntry = prev[itemId];
            const updatedEntry = { ...currentEntry, [field]: numValue };

            // Recalculate end balance
            updatedEntry.end_bal = updatedEntry.beg_bal + updatedEntry.delivery - updatedEntry.usage_amount - updatedEntry.waste;

            return {
                ...prev,
                [itemId]: updatedEntry
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!department.trim()) {
            toast.error('Please enter a department');
            return;
        }

        try {
            setSubmitting(true);

            // Convert entries object to array
            const entriesArray = Object.values(entries);

            await inventoryAPI.submitSheet({
                sheet_date: sheetDate,
                department,
                entries: entriesArray
            });

            toast.success('Inventory sheet submitted successfully');

            // Export to Excel automatically
            try {
                const exportData = items.map((item) => {
                    const entry = entries[item.id] || { beg_bal: 0, delivery: 0, usage_amount: 0, waste: 0, end_bal: 0 };
                    return {
                        'Code': item.item_code,
                        'Item Description': item.description,
                        'Category': item.category,
                        'Beg. Bal.': entry.beg_bal,
                        'Delivery': entry.delivery,
                        'Usage': entry.usage_amount,
                        'Waste': entry.waste,
                        'End Bal.': entry.end_bal,
                    };
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Inventory Details');

                const safeDepartment = department.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const fileName = `Inventory_Sheet_${safeDepartment}_${sheetDate}.xlsx`;

                // Use explicit Blob download to ensure proper filename and extension in all browsers
                const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                saveAs(data, fileName);
            } catch (exportError) {
                console.error('Error exporting to Excel:', exportError);
                toast.error('Sheet was submitted, but failed to export Excel.');
            }

            // Reload to get fresh data (which will now have the new balances)
            await loadData();
            setDepartment(''); // Reset department

        } catch (error) {
            console.error('Error submitting sheet:', error);
            toast.error('Failed to submit inventory sheet');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading inventory form...</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Inventory Sheet</h1>
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={loadData}
                        className="btn btn-secondary"
                        disabled={submitting}
                    >
                        Reset / Reload
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                    >
                        {submitting ? 'Submitting...' : 'Submit Sheet'}
                    </button>
                </div>
            </div>

            {/* Header Form */}
            <div className="card p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sheet Date
                    </label>
                    <input
                        type="date"
                        required
                        className="input-field"
                        value={sheetDate}
                        onChange={(e) => setSheetDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="e.g. Bar, Kitchen"
                        className="input-field"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                    />
                </div>
                {/* We rely on the auth token for "Performed By", but we can show it here if needed */}
            </div>

            {/* Grid */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">Item Description</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Beg. Bal.</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider text-red-600">Waste</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider bg-gray-100">End Bal.</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((item) => {
                                const entry = entries[item.id] || { beg_bal: 0, delivery: 0, usage_amount: 0, waste: 0, end_bal: 0 };

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {item.item_code}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {item.description}
                                        </td>

                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <input
                                                type="number"
                                                min="0" step="any"
                                                className="w-full text-center border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm py-1"
                                                value={entry.beg_bal === 0 ? '' : entry.beg_bal}
                                                onChange={(e) => handleEntryChange(item.id, 'beg_bal', e.target.value)}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <input
                                                type="number"
                                                min="0" step="any"
                                                className="w-full text-center border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm py-1 bg-green-50"
                                                value={entry.delivery === 0 ? '' : entry.delivery}
                                                onChange={(e) => handleEntryChange(item.id, 'delivery', e.target.value)}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <input
                                                type="number"
                                                min="0" step="any"
                                                className="w-full text-center border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm py-1 bg-blue-50"
                                                value={entry.usage_amount === 0 ? '' : entry.usage_amount}
                                                onChange={(e) => handleEntryChange(item.id, 'usage_amount', e.target.value)}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <input
                                                type="number"
                                                min="0" step="any"
                                                className="w-full text-center border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 sm:text-sm py-1 bg-red-50"
                                                value={entry.waste === 0 ? '' : entry.waste}
                                                onChange={(e) => handleEntryChange(item.id, 'waste', e.target.value)}
                                                placeholder="0"
                                            />
                                        </td>

                                        <td className="px-4 py-2 whitespace-nowrap bg-gray-100 text-center font-bold text-gray-900">
                                            {Number(entry.end_bal).toFixed(2).replace(/\.00$/, '')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </form>
    );
};

export default Inventory;
