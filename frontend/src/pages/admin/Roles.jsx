import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Modal, Confirm, Loader, Empty } from '../../components/Shared';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Shield, Check, X, ShieldCheck } from 'lucide-react';
import { RBAC_CATALOG, DATA_SCOPES } from '../../utils/rbacRegistry';

const createDefaultPermissions = () => {
  const modules = {};
  RBAC_CATALOG.forEach(mod => {
    const menus = {};
    mod.menus.forEach(m => {
      menus[m.path] = { read: true, create: true, edit: true, delete: false, export: false, approve: false };
    });
    modules[mod.key] = { enabled: true, scope: 'all', menus };
  });
  return { modules };
};

export default function AdminRoles() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeModuleTab, setActiveModuleTab] = useState(RBAC_CATALOG[0].key);
  const [form, setForm] = useState({ name: '', permissions: createDefaultPermissions() });
  const [deleting, setDeleting] = useState(null);

  const load = () => api.get('/roles/').then(r => setItems(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ name: '', permissions: createDefaultPermissions() });
    setEditing(null);
    setActiveModuleTab(RBAC_CATALOG[0].key);
    setModal(true);
  };

  const openEdit = (roleItem) => {
    let perms = roleItem.permissions || {};
    if (!perms.modules) {
      // Legacy format migration helper in UI
      const def = createDefaultPermissions();
      if (perms.can_read !== undefined) {
        Object.keys(def.modules).forEach(modKey => {
          def.modules[modKey].enabled = !!perms.can_read;
          Object.keys(def.modules[modKey].menus).forEach(mPath => {
            def.modules[modKey].menus[mPath].read = !!perms.can_read;
            def.modules[modKey].menus[mPath].create = !!perms.can_create;
            def.modules[modKey].menus[mPath].edit = !!perms.can_edit;
            def.modules[modKey].menus[mPath].delete = !!perms.can_delete;
          });
          if (perms.view_own_records_only) def.modules[modKey].scope = 'own';
          else if (perms.view_team_records_only) def.modules[modKey].scope = 'team';
        });
      }
      perms = def;
    }
    setForm({ name: roleItem.name, permissions: perms });
    setEditing(roleItem.id);
    setActiveModuleTab(RBAC_CATALOG[0].key);
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/roles/${editing}`, form);
        toast.success('Role updated');
      } else {
        await api.post('/roles/', form);
        toast.success('Role created');
      }
      setModal(false);
      load();
    } catch { toast.error('Failed to save role'); }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/roles/${deleting.id}`);
      toast.success('Role deleted');
      setDeleting(null);
      load();
    } catch { toast.error('Failed to delete role'); }
  };

  const toggleModuleEnabled = (modKey) => {
    setForm(f => {
      const curMod = f.permissions?.modules?.[modKey] || { enabled: true, scope: 'all', menus: {} };
      return {
        ...f,
        permissions: {
          ...f.permissions,
          modules: {
            ...f.permissions?.modules,
            [modKey]: { ...curMod, enabled: !curMod.enabled }
          }
        }
      };
    });
  };

  const setModuleScope = (modKey, scope) => {
    setForm(f => {
      const curMod = f.permissions?.modules?.[modKey] || { enabled: true, scope: 'all', menus: {} };
      return {
        ...f,
        permissions: {
          ...f.permissions,
          modules: {
            ...f.permissions?.modules,
            [modKey]: { ...curMod, scope }
          }
        }
      };
    });
  };

  const toggleMenuAction = (modKey, menuPath, action) => {
    setForm(f => {
      const curMod = f.permissions?.modules?.[modKey] || { enabled: true, scope: 'all', menus: {} };
      const curMenu = curMod.menus?.[menuPath] || {};
      return {
        ...f,
        permissions: {
          ...f.permissions,
          modules: {
            ...f.permissions?.modules,
            [modKey]: {
              ...curMod,
              menus: {
                ...curMod.menus,
                [menuPath]: {
                  ...curMenu,
                  [action]: !curMenu[action]
                }
              }
            }
          }
        }
      };
    });
  };

  const currentModCatalog = RBAC_CATALOG.find(m => m.key === activeModuleTab) || RBAC_CATALOG[0];
  const currentModFormState = form.permissions?.modules?.[activeModuleTab] || { enabled: true, scope: 'all', menus: {} };

  return (
    <Layout title="Role Management">
      <div className="toolbar">
        <h1 className="h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} className="text-accent" /> Role & Permission Matrix
        </h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> New Role</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40 }}><Loader /></div> : items.length === 0 ? <Empty message="No roles defined" /> : (
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Role Name</th>
                <th>Enabled Modules & Scope</th>
                <th width="120" style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const mods = i.permissions?.modules || {};
                return (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 700, paddingLeft: 20, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
                        {i.name}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {RBAC_CATALOG.map(mc => {
                          const mData = mods[mc.key];
                          if (!mData || mData.enabled === false) return null;
                          return (
                            <span key={mc.key} style={{
                              fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--border)',
                              padding: '4px 10px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6
                            }}>
                              <span style={{ fontWeight: 600 }}>{mc.name}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px',
                                borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)'
                              }}>
                                {mData.scope || 'all'}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-icon btn-ghost" onClick={() => openEdit(i)} title="Edit Role Matrix"><Pencil size={15} /></button>
                      <button className="btn btn-icon btn-ghost text-danger" onClick={() => setDeleting(i)} title="Delete Role"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* EDIT / CREATE ROLE MATRIX MODAL */}
      {modal && (
        <Modal
          title={editing ? `Edit Role Matrix: ${form.name}` : "Create New Role Matrix"}
          onClose={() => setModal(false)}
          maxWidth="900px"
        >
          <form onSubmit={save}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Role Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sales Manager, HR Executive, Finance Analyst"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)' }}
              />
            </div>

            {/* Module Tabs Header */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid var(--border)', marginBottom: 16, paddingBottom: 4 }}>
              {RBAC_CATALOG.map(mod => {
                const isEnabled = form.permissions?.modules?.[mod.key]?.enabled !== false;
                const isActive = activeModuleTab === mod.key;
                return (
                  <button
                    type="button"
                    key={mod.key}
                    onClick={() => setActiveModuleTab(mod.key)}
                    style={{
                      padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                      whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                      background: isActive ? 'var(--accent)' : 'var(--bg2)',
                      color: isActive ? '#fff' : isEnabled ? 'var(--text)' : 'var(--text2)',
                      opacity: isEnabled ? 1 : 0.6
                    }}
                  >
                    {mod.name}
                  </button>
                );
              })}
            </div>

            {/* Current Module Permissions Panel */}
            <div style={{ background: 'var(--bg2)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{currentModCatalog.name} Module Settings</h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text2)' }}>Configure data visibility scope and menu level action permissions.</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={currentModFormState.enabled !== false}
                    onChange={() => toggleModuleEnabled(currentModCatalog.key)}
                  />
                  Enable Module
                </label>
              </div>

              {/* Scope Selection */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Data Visibility Scope (Records Filter)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  {DATA_SCOPES.map(sc => {
                    const isSelected = (currentModFormState.scope || 'all') === sc.key;
                    return (
                      <div
                        key={sc.key}
                        onClick={() => setModuleScope(currentModCatalog.key, sc.key)}
                        style={{
                          padding: 10, borderRadius: 6, border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent-dim)' : 'var(--bg)', cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                          {sc.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{sc.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Menu & Action Table */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Menu & Action Permissions
                </label>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Sub-Menu</th>
                      {['read', 'create', 'edit', 'delete', 'approve', 'export'].map(act => (
                        <th key={act} style={{ padding: '8px 12px', textAlign: 'center', textTransform: 'capitalize' }}>{act}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentModCatalog.menus.map(menu => {
                      const menuPerms = currentModFormState.menus?.[menu.path] || {};
                      return (
                        <tr key={menu.path} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{menu.label}</td>
                          {['read', 'create', 'edit', 'delete', 'approve', 'export'].map(act => {
                            const isAvailable = menu.actions.includes(act);
                            if (!isAvailable) {
                              return <td key={act} style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 12 }}>-</td>;
                            }
                            const isChecked = !!menuPerms[act];
                            return (
                              <td key={act} style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMenuAction(currentModCatalog.key, menu.path, act)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Role Matrix</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          title="Delete Role"
          message={`Are you sure you want to delete role "${deleting.name}"?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Layout>
  );
}
