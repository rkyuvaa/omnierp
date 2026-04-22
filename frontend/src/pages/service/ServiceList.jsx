import ModuleList from '../../components/ModuleList';

export default function ServiceList() {
  return (
    <ModuleList
      title="Vehicle Service"
      endpoint="/service"
      module="service"
      formPath="/service"
      exportPath="/service/export/excel"
      columns={[
        { key: 'customer_name', label: 'Customer', bold: true },
        { key: 'vehicle_number', label: 'Vehicle No' },
        { key: 'vehicle_make', label: 'Make', muted: true },
        { key: 'staff_name', label: 'Staff', muted: true },
      ]}
    />
  );
}
