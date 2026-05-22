import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { LogIn, LogOut, Camera, X, Loader, MapPin } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
   STATE COLOURS
   No punch today     → accent purple  (invite to check in)
   Checked in (only)  → emerald green  (you're in!)
   Checked out        → slate blue     (day done)
   ────────────────────────────────────────────────────────────────────── */
const STATES = {
  none: {
    label: 'Check In',
    Icon: LogIn,
    gradient: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
    shadow: '0 4px 24px rgba(99,102,241,0.55)',
    ring: '#a5b4fc',
  },
  in: {
    label: 'Check Out',
    Icon: LogOut,
    gradient: 'linear-gradient(135deg,#16a34a 0%,#22c55e 100%)',
    shadow: '0 4px 24px rgba(34,197,94,0.55)',
    ring: '#86efac',
  },
  done: {
    label: 'Done',
    Icon: LogOut,
    gradient: 'linear-gradient(135deg,#334155 0%,#475569 100%)',
    shadow: '0 4px 24px rgba(51,65,85,0.4)',
    ring: '#94a3b8',
  },
};

export default function PunchButton() {
  const { user } = useAuth();
  const [state, setState] = useState('none');   // 'none' | 'in' | 'done'
  const [todayData, setTodayData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState('idle');     // idle | locating | camera | submitting
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pulse, setPulse] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  /* Only render for employees with mobile punch enabled */
  if (!user?.enable_mobile_punch || !user?.employee_id) return null;

  /* ── Load today's status on mount + every 60 s ─────────────────── */
  useEffect(() => {
    loadToday();
    const t = setInterval(loadToday, 60000);
    return () => clearInterval(t);
  }, []);

  async function loadToday() {
    try {
      const res = await api.get(`/hr/attendance/today/${user.employee_id}`);
      setTodayData(res.data);
      if (res.data.check_in && res.data.check_out) setState('done');
      else if (res.data.check_in) setState('in');
      else setState('none');
    } catch { /* silently ignore */ }
  }

  /* ── Button click: start the punch flow ────────────────────────── */
  function openFlow() {
    if (state === 'done') {
      toast.success('You have already checked in and out today!');
      return;
    }
    setStep('locating');
    setPhotoBlob(null);
    setPhotoPreview(null);
    setLocation(null);
    setLocationName('');
    setShowModal(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ latitude, longitude });
        // Reverse geocode using a free API
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const d = await r.json();
          setLocationName(d.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } catch {
          setLocationName(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setStep('camera');
        startCamera();
      },
      (err) => {
        toast.error('Location access denied. Please allow location to punch.');
        setShowModal(false);
        setStep('idle');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  /* ── Camera helpers ─────────────────────────────────────────────── */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error('Camera access denied. Please allow camera to punch.');
      setShowModal(false);
      stopCamera();
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      setPhotoBlob(blob);
      setPhotoPreview(canvas.toDataURL('image/jpeg'));
      stopCamera();
      setStep('preview');
    }, 'image/jpeg', 0.8);
  }

  function retake() {
    setPhotoBlob(null);
    setPhotoPreview(null);
    setStep('camera');
    startCamera();
  }

  /* ── Submit punch ────────────────────────────────────────────────── */
  async function submitPunch() {
    if (!photoBlob || !location) return;
    setStep('submitting');
    const fd = new FormData();
    fd.append('employee_id', user.employee_id);
    fd.append('latitude', location.latitude);
    fd.append('longitude', location.longitude);
    fd.append('location_name', locationName);
    fd.append('photo', photoBlob, 'punch.jpg');
    try {
      await api.post('/hr/attendance/punch/mobile', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const verb = state === 'none' ? 'Check-In' : 'Check-Out';
      toast.success(`${verb} recorded successfully! ✅`);
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
      setShowModal(false);
      setStep('idle');
      loadToday();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Punch failed');
      setStep('preview');
    }
  }

  function closeModal() {
    stopCamera();
    setShowModal(false);
    setStep('idle');
  }

  const cfg = STATES[state];

  return (
    <>
      {/* ── Floating Button ──────────────────────────────────────────── */}
      <button
        onClick={openFlow}
        title={cfg.label}
        style={{
          position: 'fixed',
          top: 14,
          right: 16,
          zIndex: 9999,
          width: 46,
          height: 46,
          borderRadius: '50%',
          border: `2.5px solid ${cfg.ring}`,
          background: cfg.gradient,
          boxShadow: cfg.shadow,
          cursor: state === 'done' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: pulse ? 'scale(1.25)' : 'scale(1)',
          outline: 'none',
        }}
        onMouseEnter={e => { if (state !== 'done') e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <cfg.Icon size={20} color="#fff" strokeWidth={2.5} />

        {/* Pulse ring when checked-in */}
        {state === 'in' && (
          <span style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '2px solid #22c55e', opacity: 0.5,
            animation: 'punch-ping 1.8s ease-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </button>

      {/* ── CSS for pulse animation ───────────────────────────────────── */}
      <style>{`
        @keyframes punch-ping {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'var(--bg)',
            borderRadius: 20,
            padding: 0,
            width: '100%',
            maxWidth: 380,
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{
              background: cfg.gradient,
              padding: '18px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
                  {state === 'none' ? '🟢 Check In' : '🔴 Check Out'}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>
                  {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date().toLocaleDateString('en-IN')}
                </div>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Step: Locating */}
              {step === 'locating' && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Loader size={36} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Getting your location...</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Please allow location access</div>
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Step: Camera */}
              {step === 'camera' && (
                <div>
                  {/* Location badge */}
                  {locationName && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}>
                      <MapPin size={14} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text2)', lineHeight: 1.4 }}>{locationName.slice(0, 80)}{locationName.length > 80 ? '…' : ''}</span>
                    </div>
                  )}
                  {/* Live camera feed */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '4/3', marginBottom: 14, position: 'relative' }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    {/* Face guide ring */}
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                    }}>
                      <div style={{
                        width: 120, height: 140, border: '2.5px dashed rgba(255,255,255,0.5)',
                        borderRadius: '50%',
                      }} />
                    </div>
                  </div>
                  <button onClick={takePhoto} style={{
                    width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                    background: cfg.gradient, color: '#fff', fontWeight: 700, fontSize: 15,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: cfg.shadow,
                  }}>
                    <Camera size={18} /> Take Selfie
                  </button>
                </div>
              )}

              {/* Step: Preview */}
              {step === 'preview' && (
                <div>
                  {locationName && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}>
                      <MapPin size={14} style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }} />
                      <span style={{ color: 'var(--text2)', lineHeight: 1.4 }}>{locationName.slice(0, 80)}{locationName.length > 80 ? '…' : ''}</span>
                    </div>
                  )}
                  <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, position: 'relative' }}>
                    <img src={photoPreview} alt="Selfie preview" style={{ width: '100%', display: 'block', borderRadius: 12, transform: 'scaleX(-1)' }} />
                    <div style={{
                      position: 'absolute', bottom: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '3px 8px',
                      fontSize: 11, color: '#fff', fontWeight: 600,
                    }}>
                      {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={retake} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                      Retake
                    </button>
                    <button onClick={submitPunch} style={{
                      flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                      background: cfg.gradient, color: '#fff', fontWeight: 700, fontSize: 14,
                      cursor: 'pointer', boxShadow: cfg.shadow,
                    }}>
                      {state === 'none' ? '✅ Confirm Check-In' : '🔴 Confirm Check-Out'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Submitting */}
              {step === 'submitting' && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <Loader size={36} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Recording your punch...</div>
                </div>
              )}

              {/* Today status strip (always visible) */}
              {todayData?.check_in && (
                <div style={{ marginTop: 16, background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>🟢 In: {todayData.check_in?.slice(11, 16)}</span>
                  {todayData.check_out
                    ? <span style={{ color: '#ef4444', fontWeight: 700 }}>🔴 Out: {todayData.check_out?.slice(11, 16)}</span>
                    : <span style={{ color: 'var(--text3)' }}>Out: Pending</span>
                  }
                  {todayData.hours_worked > 0 && (
                    <span style={{ color: 'var(--text2)', fontWeight: 600 }}>⏱ {todayData.hours_worked?.toFixed(1)}h</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
