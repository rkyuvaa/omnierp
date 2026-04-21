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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%', marginBottom: 8 }}>
      {[
        { key: 'Service', label: 'Service', count: summary.service, icon: LifeBuoy, color: '#3B82F6' },
        { key: 'Maintenance', label: 'Maintenance', count: summary.maintenance, icon: Wrench, color: '#F59E0B' },
        { key: 'Vehicle Delivery', label: 'Vehicle Delivery', count: summary.vehicle_delivery, icon: Truck, color: '#6366F1' }
      ].map(t => (
        <div 
          key={t.key}
          onClick={(e) => { e.stopPropagation(); setIssueType(issueType === t.key ? null : t.key); }}
          style={{
            background: issueType === t.key ? `${t.color}10` : 'var(--bg3)',
            border: `1.5px solid ${issueType === t.key ? t.color : 'var(--border)'}`,
            borderRadius: 16,
            padding: '16px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            boxShadow: issueType === t.key ? `0 4px 12px ${t.color}20` : 'none'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{t.count}</div>
          </div>
          <div style={{ 
            width: 42, height: 42, borderRadius: 12, 
            background: issueType === t.key ? t.color : `${t.color}15`, 
            color: issueType === t.key ? 'white' : t.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
            <t.icon size={20} />
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
      headerContent={Dashboard}
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
