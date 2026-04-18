import ModuleList from '../../components/ModuleList';

export default function BOMList() {
  return (
    <ModuleList
      title="BOM / Models"
      module="warranty"
      endpoint="/warranty/boms"
      formPath="/warranty/bom"
      exportPath="/warranty/boms/export/excel"
      columns={[
        { key: 'name', label: 'BOM Name', bold: true },
        { key: 'description', label: 'Description' }
      ]}
    />
  );
}
