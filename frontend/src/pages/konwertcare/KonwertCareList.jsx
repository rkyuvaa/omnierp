import ModuleList from '../../components/ModuleList';

export default function KonwertCareList() {
  return (
    <ModuleList
      title="Konwert Care+"
      module="konwertcare"
      endpoint="/konwertcare"
      formPath="/konwertcare"
      exportPath="/konwertcare/export/excel"
      columns={[
        { key: 'customer_name', label: 'Customer' },
        { key: 'vehicle_number', label: 'Vehicle' },
        { key: 'issue_type', label: 'Issue' },
        { key: 'phone', label: 'Phone' }
      ]}
    />
  );
}
