import ModuleList from '../../components/ModuleList';

export default function ProductList() {
  return (
    <ModuleList
      title="Warranty Products"
      module="warranty"
      endpoint="/warranty/products"
      formPath="/warranty/products"
      exportPath="/warranty/products/export/excel"
      columns={[
        { key: 'name', label: 'Product Name', bold: true },
        { key: 'serial_number', label: 'Serial No.' },
        { key: 'warranty_unit', label: 'Unit', muted: true }
      ]}
    />
  );
}
