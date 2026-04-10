import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Loader, Badge } from '../components/Shared';
import api from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Wrench, ClipboardList, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/dashboard/').then(r => setData(r.data)); }, []);

  if (!data) return <Layout title="Dashboard"><Loader /></Layout>;

  const { stats, leads_by_stage, inst_by_stage, svc_by_stage, recent_leads } = data;

  const statCards = [
    { label: 'Total Leads', value: stats.leads, icon: TrendingUp, color: 'var(--accent)', bg: 'var(--accent-dim)' },
    { label: 'Customers', value: stats.customers, icon: Users, color: 'var(--green)', bg: 'var(--green-dim)' },
    { label: 'Installations', value: stats.installations, icon: Wrench, color: 'var(--amber)', bg: 'var(--amber-dim)' },
    { label: 'Service Requests', value: stats.services, icon: ClipboardList, color: 'var(--red)', bg: 'var(--red-dim)' },
  ];

  return (
    <Layout title="Dashboard">
      <div className="stats-grid">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
            <div className="stat-icon" style={{ background: bg }}><Icon size={20} style={{ color }} /></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          { title: 'CRM Pipeline', data: leads_by_stage },
          { title: 'Installation Status', data: inst_by_stage },
          { title: 'Service Status', data: svc_by_stage },
        ].map(({ title, data: chartData }) => (
          <div key={title} className="card">
            <div className="card-header"><span className="card-title">{title}</span></div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="stage" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Recent Leads</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Reference</th><th>Title</th><th>Stage</th><th>Created</th></tr></thead>
            <tbody>
              {recent_leads.map(l => (
                <tr key={l.ref}>
                  <td><span className="ref-text">{l.ref}</span></td>
                  <td>{l.title}</td>
                  <td>{l.stage && <Badge color="#6366f1">{l.stage}</Badge>}</td>
                  <td className="text-muted text-sm">{l.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
