import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export function useList(endpoint, params = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (extra = {}) => {
    setLoading(true);
    try {
      const r = await api.get(endpoint, { params: { ...params, ...extra } });
      if (r.data.items !== undefined) { setItems(r.data.items); setTotal(r.data.total); }
      else { setItems(r.data); setTotal(r.data.length); }
    } finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  return { items, total, loading, reload: load };
}

export function useStages(module) {
  const [stages, setStages] = useState([]);
  useEffect(() => { api.get(`/studio/stages/${module}`).then(r => setStages(r.data)); }, [module]);
  return stages;
}

export function useUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get('/users/').then(r => setUsers(r.data)).catch(() => {}); }, []);
  return users;
}

export function useCustomFields(module) {
  const [fields, setFields] = useState([]);
  useEffect(() => { api.get(`/studio/fields/${module}`).then(r => setFields(r.data)); }, [module]);
  return fields;
}
