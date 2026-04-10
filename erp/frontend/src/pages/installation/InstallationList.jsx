import ModuleList from '../../components/ModuleList';

export default function InstallationList() {
  return (
    <ModuleList
      title="Vehicle Installation"
      endpoint="/installation/"
      module="installation"
      formPath="/installation"
      exportPath="/installation/export/excel"
      columns={[
        { key: 'customer_name', label: 'Customer', bold: true },
        { key: 'vehicle_number', label: 'Vehicle No', muted: false },
        { key: 'vehicle_make', label: 'Make', muted: true },
        { key: 'technician_name', label: 'Technician', muted: true },
      ]}
    />
  );
}
