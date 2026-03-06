'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';
import { supabase } from '@/lib/supabase';
import { AppUser } from '@/lib/types';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'employee'>('employee');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/employees');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setEmployees(data || []);
    } catch { setEmployees([]); }
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const resetForm = () => { setName(''); setEmail(''); setRole('employee'); setEditingUser(null); setShowForm(false); };

  const openEditForm = (user: AppUser) => {
    setEditingUser(user); setName(user.name); setEmail(user.email); setRole(user.role);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage(null);
    try {
      if (editingUser) {
        const { error } = await supabase.from('users').update({ name, role }).eq('id', editingUser.id);
        if (error) throw error;
        setMessage({ type: 'success', text: '✓ Data karyawan diperbarui' });
      } else {
        setMessage({ type: 'error', text: 'Untuk menambah karyawan baru, buat akun di Supabase Auth terlebih dahulu, lalu tambahkan row di tabel users.' });
        setSaving(false);
        return;
      }
      resetForm(); fetchEmployees();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan' });
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>👥 Manajemen Karyawan</h1>
      </div>

      {message && <div className={`mb-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>{message.text}</div>}

      {/* Edit Form */}
      {showForm && editingUser && (
        <div className="glass-card p-5 mb-6 animate-fade-in-scale">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>✏️ Edit Karyawan</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nama</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="input-field" /></div>
            <div><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as 'owner' | 'employee')} className="input-field">
                <option value="employee">Employee</option>
                <option value="owner">Owner</option>
              </select></div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Perbarui'}</button>
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Help */}
      <div className="glass-card p-4 mb-6 animate-fade-in" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          💡 <strong>Menambah karyawan baru:</strong> Buat akun di Supabase Dashboard → Authentication → Users → Add User. 
          Lalu tambahkan row di tabel <code style={{ color: 'var(--accent-blue)' }}>users</code> dengan ID yang sama, nama, email, dan role.
        </p>
      </div>

      {/* Employees Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="glass-card overflow-hidden animate-fade-in">
          <table className="data-table">
            <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Bergabung</th><th className="text-right">Aksi</th></tr></thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td style={{ color: 'var(--text-primary)' }}>{emp.name}</td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{emp.email}</td>
                  <td><span className={`badge ${emp.role === 'owner' ? 'badge-yellow' : 'badge-blue'}`}>{emp.role}</span></td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(emp.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="text-right">
                    <button onClick={() => openEditForm(emp)} className="text-xs transition-all hover:scale-110" style={{ color: 'var(--accent-blue)' }}>Edit</button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Belum ada data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
