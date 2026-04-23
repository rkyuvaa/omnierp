import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Filter, LayoutGrid, ChevronDown, Check } from 'lucide-react';

/**
 * props:
 * - onSearch: (params) => void
 * - filters: [{ label: 'My Leads', key: 'assigned_to', value: currentUserId }, ...]
 * - groupBys: [{ label: 'Stage', key: 'stage_id' }, ...]
 * - placeholder: string
 */
export default function SmartSearch({ onSearch, filters = [], groupBys = [], placeholder = "Search..." }) {
  const [inputValue, setInputValue] = useState('');
  const [activeTags, setActiveTags] = useState([]); // { type: 'search|filter|group', label, key, value }
  const [showDropdown, setShowDropdown] = useState(null); // 'filter' | 'group' | null
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerSearch = (newTags) => {
    const params = {
      search: newTags.filter(t => t.type === 'search').map(t => t.value).join(' '),
      filters: newTags.filter(t => t.type === 'filter').reduce((acc, t) => ({ ...acc, [t.key]: t.value }), {}),
      group_by: newTags.find(t => t.type === 'group')?.key || null
    };
    onSearch(params);
  };

  const addSearchTag = () => {
    if (!inputValue.trim()) return;
    const newTag = { type: 'search', label: `"${inputValue}"`, value: inputValue };
    const nextTags = [...activeTags, newTag];
    setActiveTags(nextTags);
    setInputValue('');
    triggerSearch(nextTags);
  };

  const toggleTag = (tag) => {
    const exists = activeTags.find(t => t.key === tag.key && t.type === tag.type);
    let nextTags;
    if (exists) {
      nextTags = activeTags.filter(t => !(t.key === tag.key && t.type === tag.type));
    } else {
      // If group by, remove other group bys
      if (tag.type === 'group') {
        nextTags = activeTags.filter(t => t.type !== 'group');
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

  const isSelected = (tag) => activeTags.some(t => t.key === tag.key && t.type === tag.type);

  return (
    <div className="smart-search-container" style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
      <div className="smart-search-bar" style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '4px 12px',
        minHeight: 46,
        gap: 8,
        flexWrap: 'wrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <Search size={18} color="var(--text3)" />
        
        {activeTags.map((tag, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: tag.type === 'filter' ? 'var(--accent-dim)' : tag.type === 'group' ? '#f59e0b22' : 'var(--bg3)',
            color: tag.type === 'filter' ? 'var(--accent)' : tag.type === 'group' ? '#d97706' : 'var(--text1)',
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${tag.type === 'filter' ? 'var(--accent)33' : 'transparent'}`
          }}>
            <span style={{ opacity: 0.7, fontSize: 11, textTransform: 'uppercase' }}>{tag.type}:</span>
            {tag.label}
            <X size={14} style={{ cursor: 'pointer' }} onClick={() => removeTag(i)} />
          </div>
        ))}

        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSearchTag()}
          placeholder={activeTags.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '8px 0',
            fontSize: 14,
            minWidth: 120
          }}
        />

        <div style={{ display: 'flex', gap: 4, borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowDropdown(showDropdown === 'filter' ? null : 'filter')} style={{ gap: 6 }}>
            <Filter size={15} /> Filters <ChevronDown size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowDropdown(showDropdown === 'group' ? null : 'group')} style={{ gap: 6 }}>
            <LayoutGrid size={15} /> Group By <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {showDropdown && (
        <div ref={dropdownRef} style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          background: 'var(--bg1)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          zIndex: 100,
          width: 240,
          padding: 8
        }}>
          <div style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>
            {showDropdown === 'filter' ? 'Custom Filters' : 'Group By'}
          </div>
          {(showDropdown === 'filter' ? filters : groupBys).map((opt, i) => {
            const tag = { type: showDropdown, ...opt };
            const selected = isSelected(tag);
            return (
              <div
                key={i}
                onClick={() => toggleTag(tag)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  background: selected ? 'var(--bg3)' : 'transparent',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = selected ? 'var(--bg3)' : 'transparent'}
              >
                {opt.label}
                {selected && <Check size={16} color="var(--accent)" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
