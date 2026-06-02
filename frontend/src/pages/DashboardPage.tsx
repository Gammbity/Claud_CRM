import type { ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, healthApi } from '../api/endpoints';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, TrendingUp, ShoppingCart, DollarSign, Activity } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  new: '#6366f1',
  contacted: '#f59e0b',
  proposal: '#3b82f6',
  won: '#10b981',
  lost: '#ef4444',
};

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: ElementType; color: string;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function formatUZS(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M UZS`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K UZS`;
  return `${amount} UZS`;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
    refetchInterval: 30_000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.check,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const s = stats?.summary || {};
  const leadsFunnel = stats?.leadsByStatus || [];
  const monthlyRevenue = stats?.monthlyRevenue || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Wholesale Fashion CRM Overview</p>
        </div>
        {health && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-700 font-medium">
              {health.instance} — healthy
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={s.totalCustomers || 0} icon={Users} color="bg-blue-500" />
        <StatCard label="Active Leads" value={s.totalLeads || 0} icon={TrendingUp} color="bg-purple-500" />
        <StatCard label="Total Orders" value={s.totalOrders || 0} icon={ShoppingCart} color="bg-orange-500" />
        <StatCard
          label="Monthly Revenue"
          value={formatUZS(s.revenueThisMonth || 0)}
          icon={DollarSign}
          color="bg-green-500"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{s.wonLeads || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Deals Won</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{s.conversionRate || 0}%</p>
          <p className="text-sm text-gray-500 mt-1">Conversion Rate</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-purple-600">{formatUZS(s.totalRevenue || 0)}</p>
          <p className="text-sm text-gray-500 mt-1">Total Revenue</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Revenue (6 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatUZS(v)} />
              <Tooltip formatter={(v: number) => [formatUZS(v), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Leads Funnel Pie Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Lead Funnel by Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={leadsFunnel}
                dataKey="_count.status"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {leadsFunnel.map((entry: { status: string }) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers Table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Customers by Revenue</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Company</th>
                <th className="text-right py-2 text-gray-500 font-medium">Orders</th>
                <th className="text-right py-2 text-gray-500 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.topCustomers || []).map((c: { id: string; companyName: string; orderCount: number; totalRevenue: number }) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-900">{c.companyName}</td>
                  <td className="py-2.5 text-right text-gray-600">{c.orderCount}</td>
                  <td className="py-2.5 text-right font-medium text-green-600">{formatUZS(c.totalRevenue)}</td>
                </tr>
              ))}
              {(!stats?.topCustomers?.length) && (
                <tr><td colSpan={3} className="py-4 text-center text-gray-400">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
