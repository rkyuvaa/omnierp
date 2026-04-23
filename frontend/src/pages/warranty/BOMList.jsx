import { useState } from 'react';
import ModuleList from '../../components/ModuleList';

export default function BOMList() {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' or 'components'

  const tabStyle = (active) => ({
    padding: '12px 24px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
    color: active ? 'var(--accent)' : 'var(--text3)',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  });

  return (
    <ModuleList
      title="BOM / Models"
      module="warranty"
      showStages={false}
      endpoint={activeTab === 'sales' ? '/warranty/boms' : '/warranty/components'}
      formPath={activeTab === 'sales' ? '/warranty/bom' : '/warranty/components'}
      exportPath={activeTab === 'sales' ? '/warranty/boms/export/excel' : '/warranty/components/export/excel'}
      topContent={
        <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={tabStyle(activeTab === 'components')} onClick={() => setActiveTab('components')}>Components</div>
          <div style={tabStyle(activeTab === 'sales')} onClick={() => setActiveTab('sales')}>Sales Products</div>
        </div>
      }
      columns={activeTab === 'sales' ? [
        { key: 'name', label: 'BOM Name', bold: true },
        { key: 'description', label: 'Description' }
      ] : [
        { key: 'name', label: 'Part Name', bold: true },
        { key: 'part_number', label: 'Part Number' },
        { key: 'bom_name', label: 'Used In Model' }
      ]}
    />
  );
}
