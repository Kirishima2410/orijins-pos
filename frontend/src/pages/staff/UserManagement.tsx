import React, { useEffect, useState } from 'react';
import { usersAPI } from '../../utils/api';
import { User } from '../../types';
import toast from 'react-hot-toast';

const emptyForm = { username: '', email: '', password: '', role: 'cashier', is_active: true } as any;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ search: '', role: '' });
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.getAll({ search: filters.search, role: filters.role, limit: 100 });
      setUsers(data.users || []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load(); // eslint-disable-next-line
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.email) return;

    if (editingId) {
      if (!window.confirm('Save changes to this user?')) return;
      await usersAPI.update(editingId, { username: form.username, email: form.email, role: form.role, is_active: !!form.is_active });
      toast.success('User updated successfully');
    } else {
      if (!form.password || form.password.length < 6) return;
      if (!window.confirm(`Create new ${form.role} account for ${form.username}?`)) return;
      await usersAPI.create({ username: form.username, email: form.email, password: form.password, role: form.role });
      toast.success('User created successfully');
    }
    setForm({ ...emptyForm });
    setEditingId(null);
    await load();
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setForm({ username: u.username, email: u.email, role: u.role, is_active: u.is_active, password: '' });
  };

  const remove = async (user: User) => {
    const isHardDelete = !user.is_active;
    const message = isHardDelete
      ? `PERMANENTLY DELETE user "${user.username}"? This cannot be undone.`
      : `Deactivate user "${user.username}"? They will no longer be able to log in.`;

    if (!window.confirm(message)) return;

    try {
      await usersAPI.delete(user.id);
      toast.success(isHardDelete ? 'User permanently deleted' : 'User deactivated');
      await load();
    } catch (error) {
      // Error is handled by api interceptor mostly, but if we need specific handling:
      console.error(error);
    }
  };

  const resetPwd = async (id: number) => {
    const pwd = window.prompt('Enter new password (min 6 chars):');
    if (!pwd || pwd.length < 6) return;
    await usersAPI.resetPassword(id, { new_password: pwd });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-brown-900">User Management</h1>
        <p className="mt-2 text-brown-700">Manage staff accounts and permissions</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input className="input" placeholder="Search username/email" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            <select className="input" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
              <option value="">All roles</option>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <button className="btn btn-primary" onClick={load} disabled={loading}>Apply</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Username</th>
                <th className="table-header-cell">Email</th>
                <th className="table-header-cell">Role</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {users.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell">{u.username}</td>
                  <td className="table-cell">{u.email}</td>
                  <td className="table-cell capitalize">{u.role}</td>
                  <td className="table-cell">
                    <span className={u.is_active ? 'badge-success' : 'badge-danger'}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="table-cell text-right space-x-2">
                    <button className="btn btn-outline btn-sm" onClick={() => startEdit(u)}>Edit</button>
                    <button className="btn btn-outline btn-sm" onClick={() => resetPwd(u.id)}>Reset Password</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>{u.is_active ? 'Deactivate' : 'Delete'}</button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td className="table-cell" colSpan={5}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit */}
      <div className="card">
        <div className="card-header"><h2 className="text-lg font-semibold">{editingId ? 'Edit User' : 'Add User'}</h2></div>
        <form className="card-body space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            {!editingId && (
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} minLength={6} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
            )}
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            {editingId && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <label htmlFor="active" className="text-sm">Active</label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create User'}</button>
            {editingId && <button type="button" className="btn btn-outline" onClick={() => { setEditingId(null); setForm({ ...emptyForm }); }}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;
