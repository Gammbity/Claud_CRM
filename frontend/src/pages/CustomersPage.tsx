import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { Plus, Search, Building2, Phone, Mail, MapPin, Trash2, Edit } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  prospect: 'bg-blue-100 text-blue-700',
};

interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  city?: string;
  status: string;
  _count?: { leads: number; orders: number };
}

interface CustomerForm {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  status: string;
}

const emptyForm: CustomerForm = {
  companyName: '', contactName: '', phone: '', email: '',
  address: '', city: 'Toshkent', status: 'prospect',
};

export default function CustomersPage() {
  const { isAdmin, canEdit } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customersApi.list({ search, limit: 50 }),
  });

  const createMut = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowModal(false); setForm(emptyForm); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => customersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowModal(false); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: customersApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) updateMut.mutate({ id: editId, data: form });
    else createMut.mutate(form);
  };

  const openEdit = (c: Customer) => {
    setForm({ companyName: c.companyName, contactName: c.contactName, phone: c.phone, email: c.email, address: '', city: c.city || '', status: c.status });
    setEditId(c.id);
    setShowModal(true);
  };

  const customers: Customer[] = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm">Manage your wholesale clients</p>
        </div>
        {canEdit && (
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="input pl-9"
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Company</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Contact</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Location</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Leads / Orders</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
            {!isLoading && customers.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No customers found</td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900">{c.companyName}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-gray-900">{c.contactName}</div>
                  <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
                    <Phone className="w-3 h-3" /> {c.phone}
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <Mail className="w-3 h-3" /> {c.email}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {c.city && (
                    <div className="flex items-center gap-1 text-gray-600 text-xs">
                      <MapPin className="w-3 h-3" /> {c.city}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${STATUS_BADGE[c.status] || 'bg-gray-100 text-gray-600'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {c._count?.leads ?? 0} / {c._count?.orders ?? 0}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => { if (confirm('Delete this customer?')) deleteMut.mutate(c.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-5">{editId ? 'Edit Customer' : 'Add Customer'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(Object.keys(emptyForm) as (keyof CustomerForm)[]).map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}
                    {['companyName','contactName','phone','email'].includes(key) && ' *'}
                  </label>
                  {key === 'status' ? (
                    <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="input">
                      <option value="prospect">Prospect</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  ) : (
                    <input
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="input"
                      required={['companyName','contactName','phone','email'].includes(key)}
                      type={key === 'email' ? 'email' : 'text'}
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1">
                  {editId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
