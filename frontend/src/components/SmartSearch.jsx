import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Filter, LayoutGrid, ChevronDown, Check, Star, Plus, Wand2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function SmartSearch({ module = 'default', onSearch, filters = [], groupBys = [], placeholder = "Search..." }) {
  const [inputValue, setInputValue] = useState('');
  const [activeTags, setActiveTags] = useState([]); // { type: 'filter|group|search', label, key, value }
  const [showPanel, setShowPanel] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const panelRef = useRef(null);
  
  const favKey = `omnierp_search_favs_${module}`;
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(favKey)) || []; } catch { return []; }
  });

  useEffect(() => {
    // On initial load, apply default favorite if exists
    const defaultFav = favorites.find(f => f.isDefault);
    if (defaultFav && activeTags.length === 0) {
      setActiveTags(defaultFav.tags);
      triggerSearch(defaultFav.tags);
    }
    
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false);
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

  const handleAiSearch = async () => {
    if (!inputValue.trim()) return;
    setIsSearching(true);
    try {
      const response = await api.post(`/${module}/ai-search`, { query: inputValue });
      const parsed = response.data;
      
      let nextTags = [...activeTags];
      
      // Add Active Filters from AI
      (parsed.active_filters || []).forEach(f => {
        const filterDef = filters.find(flt => flt.label === f || flt.key === f);
        if (filterDef) {
          nextTags.push({ type: 'filter', label: filterDef.label, key: filterDef.key, value: filterDef.value });
        } else {
           nextTags.push({ type: 'filter', label: `Filter: ${f}`, key: f, value: 'true' });
        }
      });
      
      // Add Group Bys from AI
      if (parsed.group_by && parsed.group_by.length > 0) {
        nextTags = nextTags.filter(t => t.type !== 'group'); // clear existing groups
        const g = parsed.group_by[0];
        const groupDef = groupBys.find(gb => gb.label === g || gb.key === g);
        if (groupDef) {
           nextTags.push({ type: 'group', label: groupDef.label, key: groupDef.key });
        } else {
           nextTags.push({ type: 'group', label: `Group By: ${g}`, key: g });
        }
      }
      
      setActiveTags(nextTags);
      triggerSearch(nextTags);
      setInputValue('');
      setIsAiMode(false);
      if (parsed.explanation) toast.success(`AI: ${parsed.explanation}`);
    } catch (error) {
      toast.error("AI couldn't process the query. Ensure the backend endpoint is configured.");
    } finally {
      setIsSearching(false);
    }
  };

  const addSearchTag = () => {
    if (!inputValue.trim()) return;
    if (isAiMode) {
      handleAiSearch();
      return;
    }
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
      if (tag.type === 'group') nextTags = activeTags.filter(t => t.type !== 'group'); // Only one group by
      else nextTags = [...activeTags];
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

  const handleAddCustomFilter = () => {
    const key = window.prompt("Enter field name to filter by (e.g. priority):");
    if (!key) return;
    const val = window.prompt(`Enter value for ${key}:`);
    if (val === null) return;
    toggleTag({ type: 'filter', label: `${key}: ${val}`, key, value: val });
  };

  const handleAddCustomGroup = () => {
    const key = window.prompt("Enter field name to group by (e.g. stage_id):");
    if (!key) return;
    toggleTag({ type: 'group', label: `Group By: ${key}`, key });
  };

  const handleSaveSearch = () => {
    const name = window.prompt("Enter a name for this search:");
    if (!name) return;
    const isDefault = window.confirm("Make this the default search view?");
    
    let newFavs = [...favorites];
    if (isDefault) newFavs = newFavs.map(f => ({ ...f, isDefault: false })); // clear other defaults
    
    newFavs.push({ id: Date.now(), name, tags: activeTags, isDefault });
    setFavorites(newFavs);
    localStorage.setItem(favKey, JSON.stringify(newFavs));
  };
  
  const applyFavorite = (fav) => {
    setActiveTags(fav.tags);
    triggerSearch(fav.tags);
    setShowPanel(false);
  };

  const deleteFavorite = (e, id) => {
    e.stopPropagation();
    const newFavs = favorites.filter(f => f.id !== id);
    setFavorites(newFavs);
    localStorage.setItem(favKey, JSON.stringify(newFavs));
  };

  const isSelected = (tag) => activeTags.some(t => t.key === tag.key && t.type === tag.type);

  return (
    <div className="smart-search-container" ref={panelRef} style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
      {/* Search Bar */}
      <div className="search-bar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        minHeight: 40,
        padding: '4px 12px'
      }}>
        <Search size={16} color="var(--text3)" />
        
        {activeTags.map((tag, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: tag.type === 'filter' ? '#714b6722' : tag.type === 'group' ? '#00a09d22' : 'var(--bg3)',
            color: tag.type === 'filter' ? '#714b67' : tag.type === 'group' ? '#00a09d' : 'var(--text1)',
            padding: '1px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${tag.type === 'filter' ? '#714b6744' : tag.type === 'group' ? '#00a09d44' : 'transparent'}`
          }}>
            {tag.label}
            <X size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeTag(i)} />
          </div>
        ))}

        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSearchTag()}
          placeholder={activeTags.length === 0 ? (isAiMode ? "Ask AI to search..." : placeholder) : ''}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '6px 0',
            fontSize: 13,
            minWidth: 100,
            color: isAiMode ? '#8e44ad' : 'inherit'
          }}
        />

        {isSearching && <div className="spinner" style={{ width: 14, height: 14, marginRight: 8 }}></div>}

        <button 
          onClick={() => { setIsAiMode(!isAiMode); if(!isAiMode) setInputValue(''); }}
          title="AI Search"
          style={{
            border: 'none',
            background: isAiMode ? '#8e44ad22' : 'transparent',
            borderRadius: 4,
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: isAiMode ? '#8e44ad' : 'var(--text3)'
          }}
        >
          <Wand2 size={16} />
        </button>

        <button 
          onClick={() => setShowPanel(!showPanel)}
          style={{
            border: 'none',
            background: showPanel ? 'var(--bg3)' : 'transparent',
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text2)'
          }}
        >
          <ChevronDown size={16} style={{ transform: showPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {/* Odoo-style Dropdown Panel */}
      {showPanel && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          left: 0,
          marginTop: 4,
          background: '#ffffff', // Force solid white background
          border: '1px solid var(--border)',
          borderRadius: 4,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)', // Stronger shadow for depth
          zIndex: 99999, // Ensure it's above everything
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          padding: '20px 24px',
          gap: 24,
          minWidth: 600
        }}>
          {/* Column 1: Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#714b67', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              <Filter size={16} fill="#714b67" /> Filters
            </div>
            {filters.map((f, i) => {
              const tag = { type: 'filter', ...f };
              const active = isSelected(tag);
              return (
                <div key={i} onClick={() => toggleTag(tag)} style={{
                  padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  background: active ? 'var(--bg3)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'} onMouseLeave={e => e.currentTarget.style.background = active ? 'var(--bg3)' : 'transparent'}>
                  {f.label}
                  {active && <Check size={14} color="#714b67" />}
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
              <div onClick={handleAddCustomFilter} style={{ padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: 'var(--text3)' }}>
                Add Custom Filter...
              </div>
            </div>
          </div>

          {/* Column 2: Group By */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00a09d', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              <LayoutGrid size={16} fill="#00a09d" /> Group By
            </div>
            {groupBys.map((g, i) => {
              const tag = { type: 'group', ...g };
              const active = isSelected(tag);
              return (
                <div key={i} onClick={() => toggleTag(tag)} style={{
                  padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  background: active ? 'var(--bg3)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'} onMouseLeave={e => e.currentTarget.style.background = active ? 'var(--bg3)' : 'transparent'}>
                  {g.label}
                  {active && <Check size={14} color="#00a09d" />}
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
              <div onClick={handleAddCustomGroup} style={{ padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Add Custom Group <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Column 3: Favorites */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f1c40f', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              <Star size={16} fill="#f1c40f" /> Favorites
            </div>
            
            {favorites.map(fav => (
              <div key={fav.id} onClick={() => applyFavorite(fav)} style={{
                padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span>{fav.name} {fav.isDefault && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>(Default)</span>}</span>
                <X size={14} style={{ opacity: 0.5 }} onClick={(e) => deleteFavorite(e, fav.id)} />
              </div>
            ))}
            {favorites.length === 0 && (
              <div style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text3)', opacity: 0.6 }}>No saved searches</div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 8 }}>
              <div onClick={handleSaveSearch} style={{ padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Save current search <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
