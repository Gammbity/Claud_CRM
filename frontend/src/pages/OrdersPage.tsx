import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi, customersApi, productsApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { Plus, ShoppingCart, Package } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  customer: { companyName: string };
  assignee: { name: string };
  items: { id: string; product: { name: string; sku: string }; quantity: number; unitPrice: string }[];
  createdAt: string;
}

export default function OrdersPage() {
  const { user, canEdit } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: 0 }]);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => ordersApi.list({ status: statusFilter, limit: 50 }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => customersApi.list({ limit: 100 }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-select'],
    queryFn: () => productsApi.list({ limit: 100 }),
  });

  const createMut = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setShowModal(false); setItems([{ productId: '', quantity: 1, unitPrice: 0 }]); },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => ordersApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const orders: Order[] = data?.data || [];
  const customers = customersData?.data || [];
  const products = productsData?.data || [];

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p: { id: string; price: string }) => p.id === productId);
    const newItems = [...items];
    newItems[index] = { productId, quantity: newItems[index].quantity, unitPrice: product ? parseFloat(product.price) : 0 };
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 text-sm">Wholesale order management</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Order
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Order #</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Customer</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Items</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Total</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!isLoading && orders.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No orders found</td></tr>}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono font-medium text-gray-900">{o.orderNumber}</td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{o.customer.companyName}</div>
                  <div className="text-xs text-gray-400">{o.assignee.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {o.items.slice(0, 2).map((item) => (
                      <span key={item.id} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        <Package className="w-3 h-3" /> {item.product.name} ×{item.quantity}
                      </span>
                    ))}
                    {o.items.length > 2 && <span className="text-xs text-gray-400">+{o.items.length - 2} more</span>}
                  </div>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  {Number(o.totalAmount).toLocaleString()} UZS
                </td>
                <td className="px-6 py-4">
                  {canEdit ? (
                    <select
                      value={o.status}
                      onChange={(e) => updateStatusMut.mutate({ id: o.id, status: e.target.value })}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_BADGE[o.status]}`}
                    >
                      {Object.keys(STATUS_BADGE).map((s) => <option key={s} value={s} className="bg-white text-gray-900">{s}</option>)}
                    </select>
                  ) : (
                    <span className={`badge ${STATUS_BADGE[o.status]}`}>{o.status}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Order Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> New Order</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate({ customerId, assignedTo: user?.id, items }); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input" required>
                  <option value="">Select customer...</option>
                  {customers.map((c: { id: string; companyName: string }) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Items *</label>
                  <button type="button" onClick={() => setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }])} className="text-xs text-blue-600 hover:underline">+ Add item</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <select value={item.productId} onChange={(e) => handleProductChange(idx, e.target.value)} className="input text-xs" required>
                          <option value="">Select product...</option>
                          {products.map((p: { id: string; name: string; sku: string }) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                      </div>
                      <div className="w-16">
                        <input type="number" value={item.quantity} min="1" onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].quantity = parseInt(e.target.value) || 1;
                          setItems(newItems);
                        }} className="input text-xs" />
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs pb-2">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg px-4 py-3 text-right">
                <span className="text-sm text-gray-500">Total: </span>
                <span className="font-bold text-gray-900">{totalAmount.toLocaleString()} UZS</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
