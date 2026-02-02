import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { expensesAPI } from '../../utils/api';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category?: string;
  expense_date: string; // yyyy-mm-dd
  created_by?: number;
  created_by_username?: string;
  created_at?: string;
  updated_at?: string;
}

const emptyForm = { description: '', amount: '', category: '', expense_date: '' } as any;

const Expenses: React.FC = () => {
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ search: '', category: '', date_from: '', date_to: '' });
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [total, setTotal] = useState<number>(0);

  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [items]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await expensesAPI.getAll(filters);
      setItems(data.expenses || []);
      setTotal(data.total_amount || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // eslint-disable-next-line
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // validation
    if (!form.description || !form.expense_date || Number(form.amount) <= 0) return;
    if (editingId) {
      await expensesAPI.update(editingId, {
        description: form.description,
        amount: Number(form.amount),
        category: form.category || undefined,
        expense_date: form.expense_date,
      });
    } else {
      await expensesAPI.create({
        description: form.description,
        amount: Number(form.amount),
        category: form.category || undefined,
        expense_date: form.expense_date,
      });
    }
    setForm({ ...emptyForm });
    setEditingId(null);
    await load();
  };

  const startEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setForm({
      description: exp.description,
      amount: String(exp.amount),
      category: exp.category || '',
      expense_date: exp.expense_date,
    });
  };

  const onDelete = async (id: number) => {
    if (!window.confirm('Delete this expense?')) return;
    await expensesAPI.delete(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brown-900">Expenses</h1>
        <p className="mt-2 text-brown-700">Track and manage operational expenses</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input className="input" placeholder="Search description/category" value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            <select className="input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="input" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
            <input type="date" className="input" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
            <button className="btn btn-primary" onClick={load} disabled={loading}>Apply</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card"><div className="card-body"><p className="text-sm text-brown-700">Total Expenses</p><p className="text-2xl font-semibold">₱{Number(total).toFixed(2)}</p></div></div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Date</th>
                <th className="table-header-cell">Description</th>
                <th className="table-header-cell">Category</th>
                <th className="table-header-cell">Amount</th>
                <th className="table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {items.map(exp => (
                <tr key={exp.id} className="table-row">
                  <td className="table-cell">{format(new Date(exp.expense_date), 'MMM dd, yyyy')}</td>
                  <td className="table-cell">{exp.description}</td>
                  <td className="table-cell">{exp.category || '-'}</td>
                  <td className="table-cell">₱{exp.amount.toFixed(2)}</td>
                  <td className="table-cell text-right space-x-2">
                    <button className="btn btn-outline btn-sm" onClick={() => startEdit(exp)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(exp.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td className="table-cell" colSpan={5}>No expenses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form */}
      <div className="card">
        <div className="card-header"><h2 className="text-lg font-semibold">{editingId ? 'Edit Expense' : 'Add Expense'}</h2></div>
        <form className="card-body space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="label">Amount</label>
              <input type="number" step="0.01" min="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Add Expense'}</button>
            {editingId && <button type="button" className="btn btn-outline" onClick={() => { setEditingId(null); setForm({ ...emptyForm }); }}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Expenses;




