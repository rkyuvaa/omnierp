import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Filter, LayoutGrid, Check } from 'lucide-react';

// Modal definition inside SmartSearch (inline to avoid dependency issues if Modal is missing)
const FilterModal = ({ columns, onClose, onApply }) => {
  const [field, setField] = useState('');
  const [operator, setOperator] = useState('ilike');
  const [value, setValue] = useState('');

  const operators = [
    { label: 'contains', value: 'ilike' },
    { label: 'is equal to', value: '=' },
    { label: 'is not equal to', value: '!=' },
    { label: 'greater than', value: '>' },
    { label: 'less than', value: '<' }
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Custom Filter</h3>
          <X size={18} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={onClose} />
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--text2)' }}>Match the following rule:</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 4 }} value={field} onChange={e => setField(e.target.value)}>
              <option value="">Select a field...</option>
              {(columns || []).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select style={{ width: 120, padding: 8, border: '1px solid var(--border)', borderRadius: 4 }} value={operator} onChange={e => setOperator(e.target.value)}>
              {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input 
              style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 4 }} 
              value={value} onChange={e => setValue(e.target.value)} placeholder="Value..." 
            />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={{ padding: '6px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} onClick={onClose}>Cancel</button>
          <button style={{ padding: '6px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => {
            if(!field) return;
            const fieldLabel = columns?.find(c => c.key === field)?.label || field;
            const opLabel = operators.find(o => o.value === operator)?.label || operator;
            onApply({ type: 'filter', label: `${fieldLabel} ${opLabel} "${value}"`, key: field, operator, value });
          }}>Apply</button>
        </div>
      </div>
    </div>
  );
};

const GroupModal = ({ columns, onClose, onApply }) => {
  const [field, setField] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Custom Group By</h3>
          <X size={18} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={onClose} />
        </div>
        <div style={{ padding: 20 }}>
          <select style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 4 }} value={field} onChange={e => setField(e.target.value)}>
            <option value="">Select a field...</option>
            {(columns || []).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={{ padding: '6px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} onClick={onClose}>Cancel</button>
          <button style={{ padding: '6px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => {
            if(!field) return;
            const fieldLabel = columns?.find(c => c.key === field)?.label || field;
            onApply({ type: 'group', label: `Group By: ${fieldLabel}`, key: field });
          }}>Apply</button>
        </div>
      </div>
    </div>
  );
};

export default function SmartSearch({ module = 'default', onSearch, filters = [], groupBys = [], columns = [], placeholder = "Search..." }) {
  const [inputValue, setInputValue] = useState('');
  const [activeTags, setActiveTags] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [allFields, setAllFields] = useState(columns); // start with standard columns
  
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // If module is set, fetch custom fields from studio layout
    if (module && module !== 'default') {
      import('../utils/api').then(({ default: api }) => {
        api.get(`/studio/layout/${module}/tabs`).then(res => {
          let extraFields = [];
          res.data.forEach(tab => {
            (tab.fields || []).forEach(f => {
              // Ensure we don't duplicate existing columns
              if (!columns.some(c => c.key === f.field_name)) {
                extraFields.push({ key: `custom_data__${f.field_name}`, label: `${f.field_label} (Custom)` });
              }
            });
          });
          setAllFields([...columns, ...extraFields]);
        }).catch(err => console.log('Could not load custom fields for search', err));
      });
    } else {
      setAllFields(columns);
    }
  }, [module, columns]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerSearch = (newTags) => {
    // Collect all field search values
    const searchValues = newTags.filter(t => t.type === 'field').map(t => `${t.key}:${t.value}`).join(' ');
    
    // Collect specific filters into a map
    const filterMap = {};
    newTags.filter(t => t.type === 'filter').forEach(t => {
      // Allow advanced operator structure if it has one
      if (t.operator) {
        if (!filterMap[t.key]) filterMap[t.key] = [];
        filterMap[t.key].push({ op: t.operator, val: t.value });
      } else {
        filterMap[t.key] = t.value;
      }
    });

    const params = {
      search: searchValues,
      filters: filterMap,
      group_by: newTags.find(t => t.type === 'group')?.key || null,
      rawTags: newTags
    };
    onSearch(params);
  };

  const toggleTag = (tag) => {
    const exists = activeTags.find(t => t.key === tag.key && t.type === tag.type && t.value === tag.value);
    let nextTags;
    if (exists) {
      nextTags = activeTags.filter(t => !(t.key === tag.key && t.type === tag.type && t.value === tag.value));
    } else {
      if (tag.type === 'group') {
        nextTags = activeTags.filter(t => t.type !== 'group'); // Only one group by
      } else {
        nextTags = [...activeTags];
      }
      nextTags.push(tag);
    }
    setActiveTags(nextTags);
    triggerSearch(nextTags);
  };

  const removeTag = (idx) => {
    const nextTags = activeTags.filter((_, i) => i !== idx);
    setActiveTags(nextTags);
    triggerSearch(nextTags);
  };
  
  const clearAll = () => {
    setActiveTags([]);
    triggerSearch([]);
    setInputValue('');
  }

  const isSelected = (tag) => activeTags.some(t => t.key === tag.key && t.type === tag.type && t.value === tag.value);

  const getColor = (type) => {
    if (type === 'filter') return { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' };
    if (type === 'group') return { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' };
    if (type === 'field') return { bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff' };
    return { bg: 'var(--bg3)', text: 'var(--text1)', border: 'transparent' };
  };

  const searchFields = [
    { label: 'Name', key: 'name' },
    { label: 'Customer', key: 'customer_name' },
    { label: 'Reference', key: 'reference' }
  ];

  return (
    <>
    <div className="smart-search-container" ref={panelRef} style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
      
      <div 
        className="search-bar" 
        onClick={() => { setShowPanel(true); inputRef.current?.focus(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          minHeight: 40,
          padding: '6px 12px',
          background: 'var(--bg1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          cursor: 'text',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        <Search size={16} color="var(--text3)" style={{ flexShrink: 0 }} />
        
        {activeTags.map((tag, i) => {
          const colors = getColor(tag.type);
          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: colors.bg,
              color: colors.text,
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${colors.border}`,
              whiteSpace: 'nowrap'
            }}>
              {tag.label}
              <X size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={(e) => { e.stopPropagation(); removeTag(i); }} />
            </div>
          );
        })}

        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            setShowPanel(true);
          }}
          onFocus={() => setShowPanel(true)}
          placeholder={activeTags.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '2px 0',
            fontSize: 13,
            minWidth: 100,
            color: 'var(--text1)'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && inputValue === '' && activeTags.length > 0) {
              removeTag(activeTags.length - 1);
            }
          }}
        />

        {activeTags.length > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); clearAll(); }}
            title="Clear all"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: 'var(--text3)' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showPanel && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 400,
          overflowY: 'auto',
          padding: '8px 0'
        }}>
          
          {inputValue.trim() && (
            <>
              <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Search for "{inputValue}" in
              </div>
              <div style={{ padding: '4px 8px' }}>
                {searchFields.map((f, i) => (
                  <div key={i} onClick={() => {
                    toggleTag({ type: 'field', label: `${f.label}: ${inputValue}`, key: f.key, value: inputValue });
                    setInputValue('');
                  }} style={{
                    padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text1)'
                  }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Search size={14} color="var(--text3)" />
                    Search <strong>{f.label}</strong> for "{inputValue}"
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}></div>
            </>
          )}

          <>
            <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Filters
            </div>
            <div style={{ padding: '4px 8px' }}>
              {filters && filters.map((f, i) => {
                const tag = { type: 'filter', label: f.label, key: f.key, value: f.value };
                const active = isSelected(tag);
                return (
                  <div key={i} onClick={() => toggleTag(tag)} style={{
                    padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    background: active ? '#e0f2fe' : 'transparent',
                    color: active ? '#0284c7' : 'var(--text1)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }} onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Filter size={14} color={active ? "#0284c7" : "var(--text3)"} />
                      {f.label}
                    </div>
                    {active && <Check size={14} color="#0284c7" />}
                  </div>
                );
              })}
              {allFields && allFields.length > 0 && (
                <div onClick={() => { setShowPanel(false); setShowFilterModal(true); }} style={{
                  padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text1)',
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 4
                }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Filter size={14} color="var(--text3)" />
                  Add Custom Filter...
                </div>
              )}
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}></div>
          </>

          <>
            <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Group By
            </div>
            <div style={{ padding: '4px 8px' }}>
              {groupBys && groupBys.map((g, i) => {
                const tag = { type: 'group', label: `Group By: ${g.label}`, key: g.key };
                const active = isSelected(tag);
                return (
                  <div key={i} onClick={() => { toggleTag(tag); setShowPanel(false); }} style={{
                    padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    background: active ? '#dcfce7' : 'transparent',
                    color: active ? '#16a34a' : 'var(--text1)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }} onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg2)')} onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <LayoutGrid size={14} color={active ? "#16a34a" : "var(--text3)"} />
                      {g.label}
                    </div>
                    {active && <Check size={14} color="#16a34a" />}
                  </div>
                );
              })}
              {allFields && allFields.length > 0 && (
                <div onClick={() => { setShowPanel(false); setShowGroupModal(true); }} style={{
                  padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text1)',
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 4
                }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <LayoutGrid size={14} color="var(--text3)" />
                  Add Custom Group...
                </div>
              )}
            </div>
          </>

        </div>
      )}
    </div>
    
    {showFilterModal && (
      <FilterModal columns={allFields} onClose={() => setShowFilterModal(false)} onApply={(tag) => { toggleTag(tag); setShowFilterModal(false); }} />
    )}
    {showGroupModal && (
      <GroupModal columns={allFields} onClose={() => setShowGroupModal(false)} onApply={(tag) => { toggleTag(tag); setShowGroupModal(false); }} />
    )}
    </>
  );
}
