import { useState, useEffect } from 'react';
import ModuleList from '../../components/ModuleList';
import api from '../../utils/api';
import { Wrench, LifeBuoy, Truck } from 'lucide-react';

export default function KonwertCareList() {
  const [summary, setSummary] = useState({ service: 0, maintenance: 0, vehicle_delivery: 0 });
  const [issueType, setIssueType] = useState(null);

  useEffect(() => {
    api.get('/konwertcare/summary').then(res => setSummary(res.data)).catch(() => {});
  }, []);

  const isVehicleDelivery = issueType === 'Vehicle Delivery';

  const Dashboard = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, width: '100%' }}>
      {[
        { key: 'Service', label: 'Service', count: summary.service, icon: LifeBuoy, color: '#3B82F6' },
        { key: 'Maintenance', label: 'Maintenance', count: summary.maintenance, icon: Wrench, color: '#F59E0B' },
        { key: 'Vehicle Delivery', label: 'Vehicle Delivery', count: summary.vehicle_delivery, icon: Truck, color: '#6366F1' }
      ].map(t => (
        <div 
          key={t.key}
          onClick={(e) => { e.stopPropagation(); setIssueType(issueType === t.key ? null : t.key); }}
          style={{
            background: 'var(--bg2)',
            border: `2px solid ${issueType === t.key ? t.color : 'transparent'}`,
            borderRadius: 24,
            padding: 24,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: issueType === t.key ? `0 12px 24px ${t.color}25` : '0 4px 12px rgba(0,0,0,0.03)',
            transform: issueType === t.key ? 'translateY(-4px)' : 'none'
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{t.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>{t.count}</div>
          </div>
          <div style={{ 
            width: 52, height: 52, borderRadius: 16, 
            background: `${t.color}15`, color: t.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <t.icon size={24} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <ModuleList
      key={isVehicleDelivery ? 'inst' : 'care'}
      title={issueType ? isVehicleDelivery ? "Installation Module: All Records" : `Konwert Care+: ${issueType}` : "All Care Requests"}
      module={isVehicleDelivery ? "installation" : "konwertcare"}
      endpoint={isVehicleDelivery ? "/installation" : "/konwertcare"}
      formPath={isVehicleDelivery ? "/installation" : "/konwertcare"}
      exportPath={isVehicleDelivery ? "/installation/export/excel" : "/konwertcare/export/excel"}
      extraFilters={isVehicleDelivery ? {} : { issue_type: issueType || undefined }}
      topContent={Dashboard}
      columns={isVehicleDelivery ? [
        { key: 'customer_name', label: 'Customer', bold: true },
        { key: 'vehicle_number', label: 'Vehicle Number' },
        { key: 'vehicle_model', label: 'Model', muted: true },
        { key: 'technician_name', label: 'Technician' }
      ] : [
        { key: 'customer_name', label: 'Customer', bold: true },
        { key: 'vehicle_number', label: 'Vehicle' },
        { key: 'issue_type', label: 'Type', muted: true },
        { key: 'phone', label: 'Phone' }
      ]}
    />
  );
}
