import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export function useList(endpoint, params = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [stageCounts, setStageCounts] = useState(null);

  const load = useCallback(async (extra = {}) => {
    setLoading(true);
    try {
      const queryParams = { skip: (page - 1) * 50, limit: 50, ...params, ...extra };
      if (queryParams.filters && typeof queryParams.filters === 'object') {
        queryParams.filters = JSON.stringify(queryParams.filters);
      }
      const r = await api.get(endpoint, { params: queryParams });
      if (r.data.items !== undefined) { 
        setItems(r.data.items); 
        setTotal(r.data.total); 
      } else { 
        setItems(r.data); 
        if (r.data.length || r.data.length === 0) setTotal(r.data.length); 
      }
      
      if (r.data.stage_counts !== undefined) { 
        setStageCounts(r.data.stage_counts); 
      } else {
        setStageCounts(null);
      }
    } finally { setLoading(false); }
  }, [endpoint, page, JSON.stringify(params)]);

  useEffect(() => { load(); }, [load]);

  return { items, total, loading, reload: load, stageCounts , page, setPage};
}

export function useStages(module) {
  const [stages, setStages] = useState([]);
  useEffect(() => { api.get(`/studio/stages/${module}`).then(r => setStages(r.data)); }, [module]);
  return stages;
}

export function useUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get('/users').then(r => setUsers(r.data)).catch(() => {}); }, []);
  return users;
}

export function useCustomFields(module) {
  const [fields, setFields] = useState([]);
  useEffect(() => { api.get(`/studio/fields/${module}`).then(r => setFields(r.data)); }, [module]);
  return fields;
}
