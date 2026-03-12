'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/authFetch';
import { AppUser } from '@/lib/types';
import { useState } from 'react';

export default function EmployeesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'owner' | 'employee'>('employee');

  const { data: employees = [], isLoading, refetch } = useQuery<AppUser[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await authFetch('/api/employees');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('employee');
    setEditingUser(null);
    setIsAddingNew(false);
    setShowForm(false);
  };

  const openAddForm = () => {
    setIsAddingNew(true);
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('employee');
    setShowForm(true);
  };

  const openEditForm = (user: AppUser) => {
    setEditingUser(user);
    setIsAddingNew(false);
    setName(user.name);
    setEmail(user.email); // Show email but don't allow editing for existing users
    setPassword('');
    setRole(user.role);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (isAddingNew) {
        // Create new employee
        const res = await authFetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, role }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Gagal menambah karyawan');
        }

        setMessage({ type: 'success', text: '✓ Karyawan berhasil ditambahkan! Password: ' + password });
        resetForm();
        refetch();
      } else if (editingUser) {
        // Update existing employee
        const updates: { name?: string; role?: string } = { name, role };

        const res = await authFetch('/api/employees', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingUser.id, ...updates }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Gagal memperbarui');
        }

        setMessage({ type: 'success', text: '✓ Data karyawan diperbarui' });
        resetForm();
        refetch();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>👥 Manajemen Karyawan</h1>
        <button onClick={openAddForm} className="btn-primary text-sm">
          + Tambah Karyawan
        </button>
      </div>

      {message && (
        <div className={`mb-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="glass-card p-5 mb-6 animate-fade-in-scale">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            {isAddingNew ? '➕ Tambah Karyawan Baru' : '✏️ Edit Karyawan'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nama Lengkap</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="input-field"
                  placeholder="Nama karyawan"
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as 'owner' | 'employee')}
                  className="input-field"
                >
                  <option value="employee">Employee (Karyawan)</option>
                  <option value="owner">Owner (Pemilik)</option>
                </select>
              </div>
            </div>

            {isAddingNew && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="input-field"
                      placeholder="email@kantor.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="input-field"
                      placeholder="Min. 6 karakter"
                    />
                  </div>
                </div>
              </>
            )}

            {!isAddingNew && editingUser && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Email: {editingUser.email}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Menyimpan...' : isAddingNew ? 'Tambah Karyawan' : 'Perbarui'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="glass-card overflow-hidden animate-fade-in">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Bergabung</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td style={{ color: 'var(--text-primary)' }}>{emp.name}</td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{emp.email}</td>
                  <td>
                    <span className={`badge ${emp.role === 'owner' ? 'badge-yellow' : 'badge-blue'}`}>
                      {emp.role === 'owner' ? 'Owner' : 'Karyawan'}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {emp.created_at ? new Date(emp.created_at).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => openEditForm(emp)}
                      className="text-xs transition-all hover:scale-110"
                      style={{ color: 'var(--accent-blue)' }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    Belum ada data karyawan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
