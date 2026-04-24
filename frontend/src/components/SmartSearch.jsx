import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Filter, LayoutGrid, Check } from 'lucide-react';

export default function SmartSearch({ module = 'default', onSearch, filters = [], groupBys = [], placeholder = "Search..." }) {
  const [inputValue, setInputValue] = useState('');
  const [activeTags, setActiveTags] = useState([]); // { type: "filter" | "group" | "field", label: "...", key: "...", value: "..." }
  const [showPanel, setShowPanel] = useState(false);
  
  const panelRef = useRef(null);
  const inputRef = useRef(null);

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
      filterMap[t.key] = t.value;
    });

    const params = {
      search: searchValues,
      filters: filterMap,
      group_by: newTags.find(t => t.type === 'group')?.key || null,
      rawTags: newTags // In case parent wants to do advanced AND/OR parsing
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

  // Map tag types to their specific colors
  const getColor = (type) => {
    if (type === 'filter') return { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' }; // Blue chips
    if (type === 'group') return { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' };  // Green chips
    if (type === 'field') return { bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff' };  // Purple chips
    return { bg: 'var(--bg3)', text: 'var(--text1)', border: 'transparent' };
  };

  // Predefined search fields available when typing
  const searchFields = [
    { label: 'Name', key: 'name' },
    { label: 'Customer', key: 'customer_name' },
    { label: 'Reference', key: 'reference' }
  ];

  return (
    <div className="smart-search-container" ref={panelRef} style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
      
      {/* Search Bar Container */}
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
        
        {/* Active Tokens */}
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

        {/* Input Field (cursor after last token) */}
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

        {/* Clear All Button */}
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

      {/* Vertical Dropdown Panel */}
      {showPanel && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 400,
          overflowY: 'auto',
          padding: '8px 0'
        }}>
          
          {/* 1. Dynamic Search Fields Section (Only shows when typing) */}
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

          {/* 2. Filters Section */}
          {filters && filters.length > 0 && (
            <>
              <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Filters
              </div>
              <div style={{ padding: '4px 8px' }}>
                {filters.map((f, i) => {
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
              </div>
              {groupBys && groupBys.length > 0 && (
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}></div>
              )}
            </>
          )}

          {/* 3. Group By Section */}
          {groupBys && groupBys.length > 0 && (
            <>
              <div style={{ padding: '4px 16px', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Group By
              </div>
              <div style={{ padding: '4px 8px' }}>
                {groupBys.map((g, i) => {
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
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
