import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, customersApi } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';
import { Plus, TrendingUp, DollarSign, ChevronRight } from 'lucide-react';

const STATUSES = ['new', 'contacted', 'proposal', 'won', 'lost'] as const;
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  contacted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  proposal: 'bg-blue-100 text-blue-700 border-blue-200',
  won: 'bg-green-100 text-green-700 border-green-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
};

interface Lead {
  id: string;
  title: string;
  status: string;
  value: string;
  notes?: string;
  customer: { companyName: string; contactName: string };
  assignee: { name: string };
  createdAt: string;
}

export default function LeadsPage() {
  const { user, canEdit } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', customerId: '', assignedTo: user?.id || '', value: '', status: 'new', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['leads', statusFilter],
    queryFn: () => leadsApi.list({ status: statusFilter, limit: 50 }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customersApi.list({ limit: 100 }),
  });

  const createMut = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); setShowModal(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => leadsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const leads: Lead[] = data?.data || [];
  const customers = customersData?.data || [];

  const formatUZS = (v: string | number) => {
    const n = Number(v);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads & Deals</h1>
          <p className="text-gray-500 text-sm">Sales pipeline management</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        )}
      </div>

      {/* Funnel status tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!statusFilter ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Pipeline funnel visual */}
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-3 overflow-x-auto">
        {STATUSES.map((s, i) => {
          const count = leads.filter((l) => l.status === s).length;
          return (
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <div className={`px-4 py-2 rounded-lg border text-center min-w-[90px] ${STATUS_COLORS[s]}`}>
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs capitalize">{s}</div>
              </div>
              {i < STATUSES.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </div>
          );
        })}
      </div>

      {/* Leads cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading && <div className="col-span-2 text-center py-8 text-gray-400">Loading...</div>}
        {!isLoading && leads.length === 0 && <div className="col-span-2 text-center py-8 text-gray-400">No leads found</div>}
        {leads.map((lead) => (
          <div key={lead.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{lead.title}</h3>
                <p className="text-sm text-gray-500">{lead.customer.companyName}</p>
              </div>
              <select
                value={lead.status}
                onChange={(e) => updateMut.mutate({ id: lead.id, data: { status: e.target.value } })}
                disabled={!canEdit}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer ${STATUS_COLORS[lead.status]}`}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-gray-500">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{lead.assignee.name}</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-green-600">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{formatUZS(lead.value)} UZS</span>
              </div>
            </div>
            {lead.notes && <p className="mt-2 text-xs text-gray-400 line-clamp-1">{lead.notes}</p>}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-5">Add Lead</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate({ ...form, assignedTo: user?.id }); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="input" required>
                  <option value="">Select customer...</option>
                  {customers.map((c: { id: string; companyName: string }) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value (UZS) *</label>
                <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                  {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
