import React, { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import ModuleList from '../../components/ModuleList';
import Layout from '../../components/Layout';
import IssueWorkMatrix from './IssueWorkMatrix';

export default function ServiceList() {
  const [view, setView] = useState('list');

  const tabStyle = (active) => ({
    padding: '5px 14px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 8,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text2)',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    display: 'inline-flex',
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

  const filters = [
    { label: 'Unassigned', key: 'staff_id', value: 'null' },
    { label: 'High Priority', key: 'priority', value: 'High' }
  ];

  const groupBys = [
    { label: 'Stage', key: 'stage_id' },
    { label: 'Staff', key: 'staff_id' }
  ];

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
      filters={filters}
      groupBys={groupBys}
      columns={[
        { key: 'customer_name', label: 'Customer', bold: true },
        { key: 'vehicle_number', label: 'Vehicle No' },
        { key: 'vehicle_make', label: 'Make', muted: true },
        { key: 'staff_name', label: 'Staff', muted: true },
      ]}
    />
  );
}
