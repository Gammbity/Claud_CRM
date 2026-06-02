import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { Plus, Package, Search, Trash2, Edit } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: string;
  stock: number;
  unit: string;
  description?: string;
}

const emptyForm = { name: '', sku: '', category: 'Outerwear', description: '', price: '', stock: '0', unit: 'pcs' };

export default function ProductsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productsApi.list({ search, limit: 100 }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: productsApi.categories,
  });

  const createMut = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowModal(false); setForm(emptyForm); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => productsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowModal(false); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const products: Product[] = data?.data || [];

  const openEdit = (p: Product) => {
    setForm({ name: p.name, sku: p.sku, category: p.category, description: p.description || '', price: p.price, stock: String(p.stock), unit: p.unit });
    setEditId(p.id);
    setShowModal(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...form, price: parseFloat(form.price), stock: parseInt(form.stock) };
    if (editId) updateMut.mutate({ id: editId, data: payload });
    else createMut.mutate(payload);
  };

  const stockColor = (stock: number) =>
    stock === 0 ? 'text-red-600 bg-red-50' : stock < 20 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 text-sm">Fashion catalogue & inventory</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." className="input pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading && <div className="col-span-4 text-center py-8 text-gray-400">Loading...</div>}
        {!isLoading && products.length === 0 && <div className="col-span-4 text-center py-8 text-gray-400">No products found</div>}
        {products.map((p) => (
          <div key={p.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{p.sku}</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">{p.name}</h3>
            <p className="text-xs text-gray-400 mb-3">{p.category}</p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                {Number(p.price).toLocaleString()} UZS
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stockColor(p.stock)}`}>
                {p.stock} {p.unit}
              </span>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-blue-600 py-1 rounded hover:bg-blue-50 transition-colors">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => { if (confirm('Delete product?')) deleteMut.mutate(p.id); }} className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-red-600 py-1 rounded hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-5">{editId ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="categories" className="input" required />
                <datalist id="categories">
                  {(categories as string[]).map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (UZS) *</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" required min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" required min="0" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1">{editId ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
