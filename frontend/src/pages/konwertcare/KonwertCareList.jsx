import { useState, useEffect } from 'react';
import ModuleList from '../../components/ModuleList';
import api from '../../utils/api';
import { Wrench, LifeBuoy, Truck, ShieldCheck, X } from 'lucide-react';
import { Modal, Loader } from '../../components/Shared';
import toast from 'react-hot-toast';

function WarrantyPreviewModal({ ids, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.all(ids.map(id => api.get(`/installation/${id}`)));
        const prods = await Promise.all(results.map(r => {
          if (r.data.product_id) return api.get(`/warranty/products/${r.data.product_id}`);
          return Promise.resolve({ data: null });
        }));
        setData(prods.map(p => p.data).filter(p => p !== null));
      } catch (err) {
        toast.error("Failed to fetch product details");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ids]);

  return (
    <Modal title="Warranty & Components Preview" onClose={onClose} width={800}>
      {loading ? <Loader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.length === 0 && <div className="text-muted">No product links found for selected records.</div>}
          {data.map(p => (
            <div key={p.id} className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                <div>
                  <div className="fw-800 size-14 color-text1">{p.title}</div>
                  <div className="text-muted size-11">S/N: <b>{p.serial_number}</b></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="size-11 fw-700 text-muted uppercase">Warranty</div>
                  <div className="size-14 fw-800 color-accent">{p.warranty_period} {p.warranty_unit}</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {(p.component_serials || []).map((c, i) => (
                  <div key={i} style={{ padding: 8, background: 'var(--bg1)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="size-11 fw-700 color-text2">{c.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="size-10 text-muted">S/N: <b>{c.serial_number || '—'}</b></span>
                      <span className="size-10 fw-800 color-success">{c.warranty_period}{c.warranty_unit?.substring(0,1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function KonwertCareList() {
  const [summary, setSummary] = useState({ service: 0, maintenance: 0, vehicle_delivery: 0 });
  const [issueType, setIssueType] = useState(null);
  const [showWarranty, setShowWarranty] = useState(null);

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
    <>
      <ModuleList
        key={isVehicleDelivery ? 'inst' : 'care'}
        title={issueType ? isVehicleDelivery ? "Installation Module: All Records" : `Konwert Care+: ${issueType}` : "All Care Requests"}
        module={isVehicleDelivery ? "installation" : "konwertcare"}
        endpoint={isVehicleDelivery ? "/installation" : "/konwertcare"}
        formPath={isVehicleDelivery ? "/installation" : "/konwertcare"}
        exportPath={isVehicleDelivery ? "/installation/export/excel" : "/konwertcare/export/excel"}
        extraFilters={isVehicleDelivery ? { stage_names: "Fitment Done,Customer Delivery,RTO Process,HSRP" } : { issue_type: issueType || undefined }}
        topContent={Dashboard}
        allowedStages={isVehicleDelivery ? ["Fitment Done", "Customer Delivery", "RTO Process", "HSRP"] : undefined}
        batchActions={(selected) => isVehicleDelivery ? (
          <button className="btn btn-primary btn-sm" style={{ fontWeight: 800, letterSpacing: '0.3px', background: 'var(--accent)', color: 'white' }} onClick={() => setShowWarranty(selected)}>
            <ShieldCheck size={14} style={{ marginRight: 6 }} /> WARRANTY PREVIEW ({selected.length})
          </button>
        ) : null}
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
      {showWarranty && <WarrantyPreviewModal ids={showWarranty} onClose={() => setShowWarranty(null)} />}
    </>
  );
}
