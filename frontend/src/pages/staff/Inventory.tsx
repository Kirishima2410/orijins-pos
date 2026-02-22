import React, { useState, useEffect } from 'react';
import { inventoryAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InventoryItem {
    id: number;
    item_code: string;
    description: string;
    category: string;
    display_order: number;
    unit_of_measurement?: string;
}

interface InventoryEntry {
    item_id: number;
    beg_bal: number;
    beg_bal_unit: string;
    delivery: number;
    delivery_unit: string;
    usage_amount: number;
    usage_unit: string;
    waste: number;
    waste_unit: string;
    end_bal: number;
    end_bal_unit: string;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheetDate]);

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

            // Attempt to fetch existing sheet for the current date
            try {
                const sheetRes = await inventoryAPI.getSheetByDate(sheetDate);
                const existingSheet = sheetRes.data;

                setDepartment(existingSheet.department || '');

                const loadedEntries: Record<number, InventoryEntry> = {};
                existingSheet.entries.forEach((e: any) => {
                    loadedEntries[e.item_id] = {
                        item_id: e.item_id,
                        beg_bal: e.beg_bal,
                        beg_bal_unit: e.beg_bal_unit || 'g',
                        delivery: e.delivery,
                        delivery_unit: e.delivery_unit || 'g',
                        usage_amount: e.usage_amount,
                        usage_unit: e.usage_unit || 'g',
                        waste: e.waste,
                        waste_unit: e.waste_unit || 'g',
                        end_bal: e.end_bal,
                        end_bal_unit: e.end_bal_unit || 'g'
                    };
                });

                // Ensure all items are present in loadedEntries in case new items were added
                fetchedItems.forEach(item => {
                    if (!loadedEntries[item.id]) {
                        loadedEntries[item.id] = {
                            item_id: item.id,
                            beg_bal: 0,
                            beg_bal_unit: item.unit_of_measurement || 'g',
                            delivery: 0,
                            delivery_unit: item.unit_of_measurement || 'g',
                            usage_amount: 0,
                            usage_unit: item.unit_of_measurement || 'g',
                            waste: 0,
                            waste_unit: item.unit_of_measurement || 'g',
                            end_bal: 0,
                            end_bal_unit: item.unit_of_measurement || 'g'
                        };
                    }
                });

                setEntries(loadedEntries);
            } catch (err: any) {
                if (err.response?.status === 404) {
                    // No sheet found for this date, init blank sheet
                    setDepartment('');

                    const initialEntries: Record<number, InventoryEntry> = {};
                    fetchedItems.forEach(item => {
                        initialEntries[item.id] = {
                            item_id: item.id,
                            beg_bal: 0,
                            beg_bal_unit: item.unit_of_measurement || 'g',
                            delivery: 0,
                            delivery_unit: item.unit_of_measurement || 'g',
                            usage_amount: 0,
                            usage_unit: item.unit_of_measurement || 'g',
                            waste: 0,
                            waste_unit: item.unit_of_measurement || 'g',
                            end_bal: 0,
                            end_bal_unit: item.unit_of_measurement || 'g'
                        };
                    });
                    setEntries(initialEntries);
                } else {
                    console.error('Error fetching existing sheet:', err);
                    toast.error('Failed to load existing sheet data.');
                }
            }
        } catch (error) {
            console.error('Error loading inventory data:', error);
            toast.error('Failed to load inventory data');
        } finally {
            setLoading(false);
        }
    };

    const handleEntryChange = (itemId: number, field: keyof InventoryEntry, value: string | number) => {
        setEntries(prev => {
            const currentEntry = prev[itemId];
            const updatedEntry = { ...currentEntry, [field]: value };

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

            toast.success('Inventory sheet submitted successfully. Data saved on this page.');

        } catch (error) {
            console.error('Error submitting sheet:', error);
            toast.error('Failed to submit inventory sheet');
        } finally {
            setSubmitting(false);
        }
    };

    const handleExportPDF = () => {
        if (!department.trim()) {
            toast.error('Please enter a department before exporting.');
            return;
        }

        try {
            const doc = new jsPDF();

            // Add Title
            doc.setFontSize(14);
            doc.text('Orijins Coffee House Inventory Sheet', 10, 15);

            // Add Header Table (Metadata)
            autoTable(doc, {
                startY: 20,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 1, fontSize: 8 },
                bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: 20, cellPadding: 1, fontSize: 8 },
                body: [
                    ['Sheet No.:', '', 'Date:', sheetDate],
                    ['Performed By:', '', 'Department:', department]
                ],
                columnStyles: {
                    0: { cellWidth: 30, fontStyle: 'bold' },
                    1: { cellWidth: 65 },
                    2: { cellWidth: 30, fontStyle: 'bold' },
                    3: { cellWidth: 65 },
                },
                margin: { left: 10, right: 10 }
            });

            // Add Main Data Table
            const tableData = items.map((item) => {
                const entry = entries[item.id] || { beg_bal: 0, delivery: 0, usage_amount: 0, waste: 0, end_bal: 0 };
                return [
                    item.item_code,
                    item.description,
                    entry.beg_bal !== 0 ? `${entry.beg_bal} ${entry.beg_bal_unit}` : '',
                    entry.delivery !== 0 ? `${entry.delivery} ${entry.delivery_unit}` : '',
                    entry.usage_amount !== 0 ? `${entry.usage_amount} ${entry.usage_unit}` : '',
                    entry.waste !== 0 ? `${entry.waste} ${entry.waste_unit}` : '',
                    entry.end_bal !== 0 ? `${entry.end_bal} ${entry.end_bal_unit}` : ''
                ];
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 3,
                theme: 'grid',
                head: [['Inventory Code', 'Item Description', 'Beg. Bal.', 'Delivery', 'Usage', 'Waste', 'End Bal.']],
                body: tableData,
                headStyles: { fillColor: [240, 240, 240], textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', cellPadding: 1, fontSize: 8 },
                bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: 20, cellPadding: { top: 1, bottom: 1, left: 2, right: 2 }, fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 65 },
                    2: { halign: 'center', cellWidth: 20 },
                    3: { halign: 'center', cellWidth: 20 },
                    4: { halign: 'center', cellWidth: 20 },
                    5: { halign: 'center', cellWidth: 20 },
                    6: { halign: 'center', cellWidth: 20 },
                },
                margin: { left: 10, right: 10 }
            });

            // Add Footer Signatures
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 5,
                theme: 'grid',
                bodyStyles: { lineColor: [0, 0, 0], lineWidth: 0.1, textColor: 20, cellPadding: 2, fontSize: 9 },
                body: [
                    ['OIC Name & Signature:', ''],
                    ['Your signature:', '']
                ],
                columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 80 }
                },
                margin: { left: 10 }
            });

            const safeDepartment = department.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `Inventory_Sheet_${safeDepartment}_${sheetDate}.pdf`;
            doc.save(fileName);
        } catch (exportError) {
            console.error('Error exporting to PDF:', exportError);
            toast.error('Failed to export PDF.');
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
                        type="button"
                        onClick={handleExportPDF}
                        className="btn btn-secondary bg-gray-600 text-white hover:bg-gray-700 font-semibold"
                        disabled={submitting}
                    >
                        Export to PDF
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                        disabled={submitting}
                    >
                        {submitting ? 'Saving...' : 'Save Sheet'}
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
                                // Provide all default structures internally
                                const defaultEntry: InventoryEntry = {
                                    item_id: item.id,
                                    beg_bal: 0, beg_bal_unit: item.unit_of_measurement || 'g',
                                    delivery: 0, delivery_unit: item.unit_of_measurement || 'g',
                                    usage_amount: 0, usage_unit: item.unit_of_measurement || 'g',
                                    waste: 0, waste_unit: item.unit_of_measurement || 'g',
                                    end_bal: 0, end_bal_unit: item.unit_of_measurement || 'g'
                                };
                                const entry = entries[item.id] || defaultEntry;

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {item.item_code}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {item.description}
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    min="0" step="any"
                                                    className="w-16 text-center border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm py-1"
                                                    value={entry.beg_bal === 0 ? '' : entry.beg_bal}
                                                    onChange={(e) => handleEntryChange(item.id, 'beg_bal', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                                <select
                                                    className="text-xs border-gray-300 rounded-md py-1 bg-white focus:ring-primary focus:border-primary"
                                                    value={entry.beg_bal_unit}
                                                    onChange={(e) => handleEntryChange(item.id, 'beg_bal_unit', e.target.value)}
                                                >
                                                    <option value="mg">mg</option><option value="g">g</option><option value="kg">kg</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    min="0" step="any"
                                                    className="w-16 text-center border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm py-1 bg-green-50"
                                                    value={entry.delivery === 0 ? '' : entry.delivery}
                                                    onChange={(e) => handleEntryChange(item.id, 'delivery', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                                <select
                                                    className="text-xs border-gray-300 rounded-md py-1 bg-green-50 focus:ring-primary focus:border-primary"
                                                    value={entry.delivery_unit}
                                                    onChange={(e) => handleEntryChange(item.id, 'delivery_unit', e.target.value)}
                                                >
                                                    <option value="mg">mg</option><option value="g">g</option><option value="kg">kg</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    min="0" step="any"
                                                    className="w-16 text-center border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm py-1 bg-blue-50"
                                                    value={entry.usage_amount === 0 ? '' : entry.usage_amount}
                                                    onChange={(e) => handleEntryChange(item.id, 'usage_amount', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                                <select
                                                    className="text-xs border-gray-300 rounded-md py-1 bg-blue-50 focus:ring-primary focus:border-primary"
                                                    value={entry.usage_unit}
                                                    onChange={(e) => handleEntryChange(item.id, 'usage_unit', e.target.value)}
                                                >
                                                    <option value="mg">mg</option><option value="g">g</option><option value="kg">kg</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap">
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    min="0" step="any"
                                                    className="w-16 text-center border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 sm:text-sm py-1 bg-red-50"
                                                    value={entry.waste === 0 ? '' : entry.waste}
                                                    onChange={(e) => handleEntryChange(item.id, 'waste', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                                <select
                                                    className="text-xs border-gray-300 rounded-md py-1 bg-red-50 focus:ring-red-500 focus:border-red-500"
                                                    value={entry.waste_unit}
                                                    onChange={(e) => handleEntryChange(item.id, 'waste_unit', e.target.value)}
                                                >
                                                    <option value="mg">mg</option><option value="g">g</option><option value="kg">kg</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 whitespace-nowrap bg-gray-100">
                                            <div className="flex items-center space-x-1">
                                                <input
                                                    type="number"
                                                    min="0" step="any"
                                                    className="w-16 text-center border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm py-1 font-bold text-gray-900 bg-transparent"
                                                    value={entry.end_bal === 0 ? '' : entry.end_bal}
                                                    onChange={(e) => handleEntryChange(item.id, 'end_bal', parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                                <select
                                                    className="text-xs border-gray-300 rounded-md py-1 bg-transparent focus:ring-primary focus:border-primary"
                                                    value={entry.end_bal_unit}
                                                    onChange={(e) => handleEntryChange(item.id, 'end_bal_unit', e.target.value)}
                                                >
                                                    <option value="mg">mg</option><option value="g">g</option><option value="kg">kg</option>
                                                </select>
                                            </div>
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
