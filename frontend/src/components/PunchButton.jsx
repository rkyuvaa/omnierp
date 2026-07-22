import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { LogIn, LogOut, Camera, X, Loader, MapPin, Clock, CheckCircle2, UserCheck } from 'lucide-react';

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
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [step, setStep] = useState('idle');     // idle | locating | camera | submitting
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [pulse, setPulse] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  /* ── Load today's status on mount + every 60 s ─────────────────── */
  useEffect(() => {
    loadToday();
    const t = setInterval(loadToday, 60000);
    return () => clearInterval(t);
  }, []);

  async function loadToday() {
    try {
      const res = await api.get('/hr/attendance/my-today');
      setTodayData(res.data);
      if (res.data.check_in && res.data.check_out) setState('done');
      else if (res.data.check_in) setState('in');
      else setState('none');
    } catch { /* silently ignore */ }
  }

  const isMobilePunch = todayData?.enable_mobile_punch || user?.enable_mobile_punch;

  /* ── Button click: start the punch flow or open info modal ────────── */
  function openFlow() {
    if (!isMobilePunch) {
      setShowInfoModal(true);
      return;
    }
    if (state === 'done') {
      setShowInfoModal(true);
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
    const empId = todayData?.employee_id || user?.employee_id;
    if (!photoBlob || !location || !empId) return;
    setStep('submitting');
    const fd = new FormData();
    fd.append('employee_id', empId);
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

  function formatTime(isoStr) {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoStr.slice(11, 16);
    }
  }

  return (
    <>
      {/* ── Inline Topbar Check-In Time Badge ───────────────────────── */}
      <button
        onClick={openFlow}
        title={isMobilePunch ? cfg.label : "Today's Attendance Status"}
        style={{
          padding: '4px 14px',
          borderRadius: 12,
          border: isMobilePunch ? `2px solid ${cfg.ring}` : '1px solid var(--border)',
          background: isMobilePunch ? cfg.gradient : (state === 'in' ? 'linear-gradient(135deg,#15803d 0%,#16a34a 100%)' : (state === 'done' ? 'linear-gradient(135deg,#1e293b 0%,#334155 100%)' : 'var(--bg3)')),
          boxShadow: isMobilePunch ? cfg.shadow : '0 2px 8px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          color: isMobilePunch || state !== 'none' ? '#fff' : 'var(--text2)',
          flexShrink: 0,
          transition: 'all 0.2s ease',
          lineHeight: '1.25',
          minWidth: 110,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
      >
        {state === 'none' && (
          isMobilePunch ? (
            <>
              <span style={{ fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                <LogIn size={12} color="#fff" strokeWidth={2.5} /> Check In
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 1 }}>--:--</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} color="var(--text3)" /> Check-In
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginTop: 1 }}>--:--</span>
            </>
          )
        )}
        {state === 'in' && (
          <>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>
              🟢 In: {formatTime(todayData?.check_in)}
            </span>
            {isMobilePunch ? (
              <span style={{ fontSize: 11, fontWeight: 800, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <LogOut size={11} color="#fff" strokeWidth={2.5} /> Check Out
              </span>
            ) : (
              <span style={{ fontSize: 10, color: '#86efac', fontWeight: 700, marginTop: 1 }}>
                {todayData?.status ? todayData.status.toUpperCase() : 'PRESENT'}
              </span>
            )}
          </>
        )}
        {state === 'done' && (
          <>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>
              In: {formatTime(todayData?.check_in)}
            </span>
            <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 700, marginTop: 1 }}>
              Out: {formatTime(todayData?.check_out)}
            </span>
          </>
        )}
      </button>

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

      {/* ── Attendance Status Info Modal ─────────────────────────────────── */}
      {showInfoModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'var(--bg2)',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 360,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={20} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>Today's Attendance</span>
              </div>
              <button onClick={() => setShowInfoModal(false)} style={{ background: 'var(--bg3)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text2)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Status</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: todayData?.check_in ? '#dcfce7' : '#f1f5f9', color: todayData?.check_in ? '#16a34a' : '#64748b' }}>
                  {todayData?.status ? todayData.status.toUpperCase() : (todayData?.check_in ? 'PRESENT' : 'NOT CHECKED IN')}
                </span>
              </div>

              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Check-In Time</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: todayData?.check_in ? '#16a34a' : 'var(--text3)' }}>
                  {todayData?.check_in ? formatTime(todayData.check_in) : '--:--'}
                </span>
              </div>

              <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Check-Out Time</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: todayData?.check_out ? '#dc2626' : 'var(--text3)' }}>
                  {todayData?.check_out ? formatTime(todayData.check_out) : 'Pending'}
                </span>
              </div>

              {todayData?.hours_worked > 0 && (
                <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>Total Hours</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {todayData.hours_worked.toFixed(2)} hours
                  </span>
                </div>
              )}
            </div>

            <button onClick={() => setShowInfoModal(false)} className="btn btn-primary" style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
