import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ModuleList from '../../components/ModuleList';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { Loader } from '../../components/Shared';
import { LayoutGrid, List, Eye, RefreshCw } from 'lucide-react';

// ── Issue/Work Matrix View ────────────────────────────────────
function IssueWorkMatrix() {
  const [stages, setStages] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, recordsRes] = await Promise.all([
        api.get('/studio/stages/service'),
        api.get('/service/?limit=200'),
      ]);
      setStages(stagesRes.data || []);
      setRecords(recordsRes.data?.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader /></div>;

  const getColor = (stage) => stage?.color || '#6366f1';

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Matrix grid: stages as columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stages.length}, minmax(200px, 1fr))`,
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
      }}>
        {stages.map(stage => {
          const stageRecords = records.filter(r => r.stage_id === stage.id);
          const color = getColor(stage);
          return (
            <div key={stage.id} style={{ minWidth: 180 }}>
              {/* Stage header */}
              <div style={{
                background: color + '22',
                border: `2px solid ${color}44`,
                borderRadius: 10,
                padding: '8px 12px',
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontWeight: 700, fontSize: 12, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {stage.name}
                </span>
                <span style={{
                  background: color,
                  color: '#fff',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  minWidth: 22,
                  textAlign: 'center',
                }}>
                  {stageRecords.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageRecords.length === 0 ? (
                  <div style={{
                    padding: '20px 12px',
                    textAlign: 'center',
                    color: 'var(--text3)',
                    fontSize: 11,
                    background: 'var(--bg3)',
                    borderRadius: 8,
                    border: '1px dashed var(--border)',
                  }}>
                    No records
                  </div>
                ) : (
                  stageRecords.map(r => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/service/${r.id}`)}
                      style={{
                        background: 'var(--bg1)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>
                        {r.reference}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                        {r.customer_name || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                        {r.vehicle_number || '—'} {r.vehicle_make ? `· ${r.vehicle_make}` : ''}
                      </div>
                      {r.problem_description && (
                        <div style={{
                          fontSize: 10,
                          color: 'var(--text2)',
                          background: 'var(--bg3)',
                          borderRadius: 6,
                          padding: '4px 8px',
                          marginTop: 4,
                          lineHeight: 1.4,
                          maxHeight: 40,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {r.problem_description}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        {r.staff_name
                          ? <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500 }}>👤 {r.staff_name}</span>
                          : <span />
                        }
                        <Eye size={11} color="var(--text3)" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ServiceList with Tab Switcher ────────────────────────
export default function ServiceList() {
  const [view, setView] = useState('list'); // 'list' | 'matrix'

  const tabStyle = (active) => ({
    padding: '5px 14px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 8,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text2)',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    transition: 'all 0.15s',
  });

  const headerTabs = (
    <>
      <button style={tabStyle(view === 'list')} onClick={() => setView('list')}>
        <List size={13} /> List
      </button>
      <button style={tabStyle(view === 'matrix')} onClick={() => setView('matrix')}>
        <LayoutGrid size={13} /> Issue/Work Matrix
      </button>
    </>
  );

  if (view === 'matrix') {
    return (
      <Layout title="Vehicle Service" headerTabs={headerTabs}>
        <IssueWorkMatrix />
      </Layout>
    );
  }

  return (
    <ModuleList
      title="Vehicle Service"
      endpoint="/service/"
      module="service"
      formPath="/service"
      exportPath="/service/export/excel"
      headerTabs={headerTabs}
      columns={[
        { key: 'customer_name', label: 'Customer', bold: true },
        { key: 'vehicle_number', label: 'Vehicle No' },
        { key: 'vehicle_make', label: 'Make', muted: true },
        { key: 'staff_name', label: 'Staff', muted: true },
      ]}
    />
  );
}
