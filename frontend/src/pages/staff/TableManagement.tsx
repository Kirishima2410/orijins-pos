import React, { useState, useEffect } from 'react';
import { tablesAPI } from '../../utils/api';
import { PlusIcon, PencilIcon, TrashIcon, QrCodeIcon, XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

interface Table {
    id: number;
    table_number: string;
    qr_code_url?: string;
    capacity: number;
    status: 'available' | 'occupied' | 'reserved';
    is_active: boolean;
}

const TableManagement: React.FC = () => {
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState<Table | null>(null);
    const [qrTable, setQrTable] = useState<Table | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
    const [baseUrl, setBaseUrl] = useState<string>(() => {
        return localStorage.getItem('qrBaseUrl') || window.location.origin;
    });

    const [formData, setFormData] = useState({
        table_number: '',
        capacity: 4,
        status: 'available',
    });

    useEffect(() => {
        fetchTables();
    }, []);

    useEffect(() => {
        if (qrTable) {
            generateQRCode(qrTable);
        }
    }, [qrTable]);

    const fetchTables = async () => {
        try {
            setLoading(true);
            const response = await tablesAPI.getAll();
            setTables(response.data);
        } catch (error) {
            console.error('Error fetching tables:', error);
            toast.error('Failed to load tables');
        } finally {
            setLoading(false);
        }
    };

    const generateQRCode = async (table: Table) => {
        try {
            // Generate URL that points to customer menu for this table
            const url = `${baseUrl}/menu/table/${table.table_number}`;
            const dataUrl = await QRCode.toDataURL(url, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });
            setQrCodeDataUrl(dataUrl);
        } catch (error) {
            console.error('Error generating QR code:', error);
            toast.error('Failed to generate QR code');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTable) {
                await tablesAPI.update(editingTable.id, formData);
                toast.success('Table updated successfully');
            } else {
                await tablesAPI.create(formData);
                toast.success('Table created successfully');
            }
            setIsModalOpen(false);
            resetForm();
            fetchTables();
        } catch (error: any) {
            console.error('Error saving table:', error);
            if (error.response?.data?.error) {
                toast.error(error.response.data.error);
            } else {
                toast.error('Failed to save table');
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this table?')) return;
        try {
            await tablesAPI.delete(id);
            toast.success('Table deleted successfully');
            fetchTables();
        } catch (error) {
            console.error('Error deleting table:', error);
            toast.error('Failed to delete table');
        }
    };

    const openEditModal = (table: Table) => {
        setEditingTable(table);
        setFormData({
            table_number: table.table_number,
            capacity: table.capacity,
            status: table.status,
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setEditingTable(null);
        setFormData({
            table_number: '',
            capacity: 4,
            status: 'available',
        });
    };

    const handleDownloadQR = () => {
        if (!qrTable || !qrCodeDataUrl) return;

        const link = document.createElement('a');
        link.href = qrCodeDataUrl;
        link.download = `table-${qrTable.table_number}-qr.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintQR = () => {
        if (!qrCodeDataUrl || !qrTable) return;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - Table ${qrTable.table_number}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                font-family: Arial, sans-serif;
              }
              h1 { margin-bottom: 20px; }
              img { max-width: 100%; height: auto; }
              p { margin-top: 20px; color: #666; }
            </style>
          </head>
          <body>
            <h1>Table ${qrTable.table_number}</h1>
            <img src="${qrCodeDataUrl}" alt="QR Code for Table ${qrTable.table_number}" />
            <p>Scan to view menu and order</p>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
            printWindow.document.close();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Table Management</h1>
                    <p className="text-sm text-gray-500">Manage dining tables and QR codes</p>

                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <label className="block text-sm font-medium text-blue-900 mb-1">
                            QR Code Base URL
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={baseUrl}
                                onChange={(e) => {
                                    setBaseUrl(e.target.value);
                                    localStorage.setItem('qrBaseUrl', e.target.value);
                                }}
                                className="input flex-1 bg-white"
                                placeholder="http://192.168.x.x:3000"
                            />
                            <div className="text-xs text-blue-700 self-center">
                                Use your computer's local network IP (e.g., 192.168.1.5:3000) so mobile devices can connect.
                            </div>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="btn btn-primary flex items-center"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Add Table
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="loading-spinner"></div>
                </div>
            ) : tables.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <div className="text-5xl mb-4">🍽️</div>
                    <h3 className="text-lg font-medium text-gray-900">No tables found</h3>
                    <p className="text-gray-500 mt-2">Get started by adding your first dining table.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {tables.map((table) => (
                        <div key={table.id} className="card hover:shadow-md transition-shadow duration-200">
                            <div className="card-body">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Table {table.table_number}</h3>
                                        <p className="text-sm text-gray-500">Capacity: {table.capacity} people</p>
                                    </div>
                                    <span
                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${table.status === 'available'
                                            ? 'bg-green-100 text-green-800'
                                            : table.status === 'occupied'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                    >
                                        {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button
                                        onClick={() => setQrTable(table)}
                                        className="btn btn-outline btn-sm flex items-center justify-center text-gray-700"
                                    >
                                        <QrCodeIcon className="w-4 h-4 mr-1" />
                                        QR Code
                                    </button>
                                    <button
                                        onClick={() => openEditModal(table)}
                                        className="btn btn-outline btn-sm flex items-center justify-center text-blue-600 border-blue-200 hover:bg-blue-50"
                                    >
                                        <PencilIcon className="w-4 h-4 mr-1" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(table.id)}
                                        className="btn btn-outline btn-sm flex items-center justify-center text-red-600 border-red-200 hover:bg-red-50 col-span-2"
                                    >
                                        <TrashIcon className="w-4 h-4 mr-1" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" onClick={() => setIsModalOpen(false)}>
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>

                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-medium leading-6 text-gray-900">
                                        {editingTable ? 'Edit Table' : 'Add New Table'}
                                    </h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                <form id="tableForm" onSubmit={handleSubmit}>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="table_number" className="label">Table Number</label>
                                            <input
                                                type="text"
                                                id="table_number"
                                                required
                                                className="input"
                                                placeholder="e.g. 1"
                                                value={formData.table_number}
                                                onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="capacity" className="label">Capacity (Seats)</label>
                                            <input
                                                type="number"
                                                id="capacity"
                                                min="1"
                                                className="input"
                                                value={formData.capacity}
                                                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="status" className="label">Status</label>
                                            <select
                                                id="status"
                                                className="input"
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            >
                                                <option value="available">Available</option>
                                                <option value="occupied">Occupied</option>
                                                <option value="reserved">Reserved</option>
                                            </select>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="submit"
                                    form="tableForm"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    {editingTable ? 'Save Changes' : 'Create Table'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {qrTable && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" onClick={() => setQrTable(null)}>
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>

                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-medium leading-6 text-gray-900">
                                        QR Code for Table {qrTable.table_number}
                                    </h3>
                                    <button onClick={() => setQrTable(null)} className="text-gray-400 hover:text-gray-500">
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="flex flex-col items-center justify-center p-4">
                                    {qrCodeDataUrl ? (
                                        <img src={qrCodeDataUrl} alt={`QR Code for Table ${qrTable.table_number}`} className="w-64 h-64 border border-gray-200 rounded-lg" />
                                    ) : (
                                        <div className="w-64 h-64 bg-gray-200 animate-pulse rounded-lg"></div>
                                    )}
                                    <p className="mt-4 text-sm text-gray-500 text-center">
                                        Scan this QR code to view the menu and order for Table {qrTable.table_number}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col sm:flex-row gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={handlePrintQR}
                                    className="inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-white hover:bg-gray-700 focus:outline-none sm:text-sm"
                                >
                                    <PrinterIcon className="w-4 h-4 mr-2" />
                                    Print
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadQR}
                                    className="inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:text-sm"
                                >
                                    <QrCodeIcon className="w-4 h-4 mr-2" />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableManagement;
