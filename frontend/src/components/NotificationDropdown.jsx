import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { Bell, Check, Info, AlertTriangle } from 'lucide-react';

export default function NotificationDropdown() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchCount();
    const interval = setInterval(fetchCount, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchCount = async () => {
    try {
      const res = await api.get(`/hr/notifications/unread-count?user_id=${user.id}`);
      setUnreadCount(res.data.count);
    } catch (e) {
      console.error("Failed to fetch notification count", e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get(`/hr/notifications/?user_id=${user.id}&limit=10`);
      setNotifications(res.data);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post(`/hr/notifications/mark-all-read?user_id=${user.id}`);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.post(`/hr/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      fetchCount();
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  };

  const formatTime = (timeStr) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return timeStr;
    }
  };

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--bg3)',
          border: 'none',
          borderRadius: 8,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text2)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s',
          outline: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            background: 'var(--red)',
            color: '#fff',
            borderRadius: '50%',
            minWidth: 16,
            height: 16,
            fontSize: 9,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid var(--bg2)',
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
              background: 'transparent',
              cursor: 'default',
            }}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 340,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg3)',
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>Notifications</span>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent2)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Check size={14} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div style={{
              maxHeight: 320,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text3)',
                  fontSize: 13,
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => {
                  let NotifIcon = Info;
                  let iconBg = 'rgba(25, 84, 2, 0.08)';
                  let iconColor = 'var(--accent)';

                  if (n.notif_type === 'success') {
                    NotifIcon = Check;
                    iconBg = 'rgba(25, 84, 2, 0.1)';
                    iconColor = 'var(--accent2)';
                  } else if (n.notif_type === 'warning') {
                    NotifIcon = AlertTriangle;
                    iconBg = 'rgba(246, 173, 85, 0.1)';
                    iconColor = 'var(--amber)';
                  }

                  return (
                    <div 
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        gap: 12,
                        cursor: n.is_read ? 'default' : 'pointer',
                        background: n.is_read ? 'var(--bg2)' : 'rgba(25, 84, 2, 0.03)',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => {
                        if (!n.is_read) e.currentTarget.style.background = 'rgba(25, 84, 2, 0.06)';
                      }}
                      onMouseLeave={e => {
                        if (!n.is_read) e.currentTarget.style.background = 'rgba(25, 84, 2, 0.03)';
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: iconBg,
                        color: iconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <NotifIcon size={16} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: n.is_read ? 500 : 700,
                          fontSize: 13,
                          color: 'var(--text)',
                          marginBottom: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {n.title}
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: 'var(--text2)',
                          lineHeight: 1.4,
                          marginBottom: 4,
                          wordBreak: 'break-word',
                        }}>
                          {n.message}
                        </div>
                        <div style={{
                          fontSize: 10,
                          color: 'var(--text3)',
                          fontWeight: 500,
                        }}>
                          {formatTime(n.created_at)}
                        </div>
                      </div>

                      {/* Unread dot */}
                      {!n.is_read && (
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          alignSelf: 'center',
                          flexShrink: 0,
                        }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
