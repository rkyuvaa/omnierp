import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../utils/api';
import { Download, RefreshCw, Upload, Database, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BackupManagement() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreScreen, setShowRestoreScreen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/backups');
      setBackups(res.data);
    } catch (error) {
      toast.error('Failed to fetch backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setGenerating(true);
    try {
      await api.post('/admin/backups/generate');
      toast.success('Backup snapshot created successfully');
      fetchBackups();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to create backup';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (filename) => {
    setDownloadingFile(filename);
    try {
      const response = await api.get(`/admin/backups/${filename}/download`, {
        responseType: 'blob',
        timeout: 0, // Disable timeout limit for downloads
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Download failed');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('WARNING: This will overwrite ALL current data and files. Are you absolutely sure?')) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/admin/backups/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 minute timeout for large restores
      });
      if (res.data.error) {
        toast.error(res.data.message);
        console.error(res.data.error);
        setRestoring(false);
      } else {
        localStorage.setItem('isRestoring', 'true');
        setShowRestoreScreen(true);
        // Wait 15 seconds to allow background restore to finish before reloading
        setTimeout(() => {
          localStorage.removeItem('isRestoring');
          toast.success('System restored successfully!');
          window.location.href = '/login'; // Force them to login just in case tokens changed
        }, 15000);
      }
    } catch (error) {
      toast.error('Restore failed. Check server logs.');
      setRestoring(false);
    } finally {
      e.target.value = '';
    }
  };

  if (showRestoreScreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={64} className="spin" style={{ color: 'var(--accent)', marginBottom: 24 }} />
        <h2 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text)' }}>System Restore in Progress...</h2>
        <p style={{ color: 'var(--text2)', marginTop: 12, fontSize: 16 }}>Please do not close this window. You will be redirected shortly.</p>
        <style>{`.spin { animation: spin 2s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Layout title="Backup & Migration">
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>System Snapshots</h1>
            <p style={{ color: 'var(--text3)', fontSize: 14 }}>Create and manage full system backups for migration or safety.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Upload size={18} />
              {restoring ? 'Restoring...' : 'Restore from File'}
              <input type="file" accept=".zip" onChange={handleRestoreFile} style={{ display: 'none' }} disabled={restoring} />
            </label>
            <button 
              className="btn btn-primary" 
              onClick={handleCreateBackup} 
              disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RefreshCw size={18} className={generating ? 'spin' : ''} />
              {generating ? 'Creating...' : 'Create Snapshot'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ padding: '16px 20px' }}>Filename</th>
                <th>Created At</th>
                <th>Size</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading backups...</td></tr>
              ) : backups.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No backups found.</td></tr>
              ) : backups.map((b) => (
                <tr key={b.filename}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ padding: 8, borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                        <Database size={20} />
                      </div>
                      <span style={{ fontWeight: 600 }}>{b.filename}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text2)', fontSize: 13 }}>
                      <Clock size={14} />
                      {new Date(b.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text3)', fontSize: 13 }}>
                    {(b.size / (1024 * 1024)).toFixed(2)} MB
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: 20 }}>
                    <button 
                      className="btn btn-ghost" 
                      onClick={() => handleDownload(b.filename)}
                      style={{ color: 'var(--accent)' }}
                      disabled={downloadingFile !== null}
                    >
                      {downloadingFile === b.filename ? (
                        <RefreshCw size={18} className="spin-fast" />
                      ) : (
                        <Download size={18} className="download-btn-icon" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 32, padding: 20, borderRadius: 12, background: 'var(--bg2)', border: '1px dashed var(--border)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} style={{ color: '#f59e0b' }} />
            Migration Tip
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
            To migrate to a new server:
            <br />
            1. Install the source code on the new server.
            <br />
            2. Generate a snapshot on the OLD server and <strong>Download</strong> it.
            <br />
            3. On the NEW server, go to this page and click <strong>Restore from File</strong>.
            <br />
            4. Upload the snapshot you just downloaded. The system will automatically restore all data, including custom fields and attachments.
          </p>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 2s linear infinite; }
        .spin-fast { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .download-btn-icon {
          transition: transform 0.2s ease;
        }
        .btn:hover:not(:disabled) .download-btn-icon {
          transform: translateY(2px);
        }
      `}</style>
    </Layout>
  );
}
