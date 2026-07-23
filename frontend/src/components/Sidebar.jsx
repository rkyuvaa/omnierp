import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, Wrench, Settings, LogOut, ClipboardList, Package, ShieldCheck, HeartPulse, Database, UserSquare, Clock, FileText, CheckSquare, DollarSign, SlidersHorizontal, ChevronDown, ChevronRight, Mail, CheckSquare2, X, Landmark, TrendingUp, Upload, Calendar, BarChart3, FileBarChart2, Cog, Receipt, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import TwoFactorSetup from './TwoFactorSetup';

const mainItems = [{to:'/',label:'Dashboard',icon:LayoutDashboard}];
const moduleItems = [
  {to:'/crm',label:'CRM',icon:Users,key:'crm'},
  {to:'/installation',label:'KIM Installation',icon:Wrench,key:'installation'},
  {to:'/service',label:'Service',icon:ClipboardList,key:'service'},
  {to:'/warranty/products',label:'Product & Warranty',icon:ShieldCheck,key:'warranty'},
  {to:'/konwertcare',label:'Konwert Care+',icon:HeartPulse,key:'konwertcare'},
  {to:'/tasks',label:'Task Management',icon:CheckSquare2,key:'tasks'}
];

const hrSubItems = [
  {to:'/hr/employees',label:'Employee Master',icon:UserSquare},
  {to:'/hr/attendance',label:'Attendance',icon:Clock},
  {to:'/hr/requests',label:'Requests',icon:FileText},
  {to:'/hr/approvals',label:'Approvals',icon:CheckSquare},
  {to:'/hr/payroll',label:'Payroll',icon:DollarSign},
  {to:'/hr/configurations',label:'Configurations',icon:SlidersHorizontal},
];
const adminItems = [
  {to:'/admin/users',label:'User Management',icon:Users},
  {to:'/admin/modules',label:'Modules',icon:SlidersHorizontal},
  {to:'/warranty/bom',label:'BOM Master',icon:Package},
  {to:'/studio',label:'Studio',icon:Settings},
  {to:'/admin/backups',label:'System Backup',icon:Database},
  {to:'/admin/settings',label:'Mailing Settings',icon:Mail},
  {to:'/audit',label:'Audit Log',icon:ClipboardList}
];


const NavItem=({to,label,icon:Icon,active,onClick})=>(<Link to={to} onClick={onClick} className={`nav-item ${active?'active':''}`} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,marginBottom:4,textDecoration:'none',fontSize:14,fontWeight:active?600:500,color:active?'#ffffff':'var(--text2)',background:active?'var(--accent)':'transparent'}} onMouseEnter={e=>{if(!active){e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)';}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)';}}}><Icon size={18} style={{opacity:active?1:0.8}}/>{label}</Link>);

function HRModule({ isActive, handleNav, isExpanded, onToggle }) {
  const { user } = useAuth();
  
  if (!user?.is_superadmin) {
    const p = user?.module_permissions?.hr;
    const hasPerm = p && (p.can_read || p.can_create || p.can_edit || p.can_delete);
    if (!hasPerm) return null;
  }
  
  const filteredHRItems = hrSubItems.filter(i => {
    if (user?.is_superadmin) return true;
    const p = user?.module_permissions?.hr || {};
    const isHRAdmin = p.can_edit || p.can_delete;
    
    if (i.to === '/hr/employees' || i.to === '/hr/attendance' || i.to === '/hr/payroll') {
      return !!isHRAdmin;
    }
    if (i.to === '/hr/configurations') {
      return false; // Only for superadmin
    }
    if (i.to === '/hr/approvals') {
      return !!isHRAdmin || !!user?.is_manager;
    }
    return true;
  });

  const isHRActive = filteredHRItems.some(i => isActive(i.to));
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={onToggle}
        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,marginBottom:4,width:'100%',border:'none',cursor:'pointer',fontSize:14,fontWeight:isHRActive?600:500,color:isHRActive?'var(--text)':'var(--text2)',background:isHRActive?'var(--bg3)':'transparent',textAlign:'left',transition:'background 0.2s, color 0.2s'}}
      >
        <Clock size={18} style={{opacity:0.8}}/>
        <span style={{flex:1}}>Attendance & HR</span>
        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden'
        }}
      >
        <div style={{ minHeight: 0, paddingLeft: 16 }}>
          {filteredHRItems.map(i => (
            <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav}/>
          ))}
        </div>
      </div>
    </div>
  );
}

const financeItems = [
  {to:'/finance/dashboard',    label:'Dashboard',      icon:Landmark},
  {to:'/finance/transactions', label:'Transactions',   icon:ClipboardList},
  {to:'/finance/import',       label:'Import Statement',icon:Upload},
  {to:'/finance/weekly',       label:'Weekly Buckets', icon:Calendar},
  {to:'/finance/pivot',        label:'Pivot Report',   icon:BarChart3},
  {to:'/finance/report',       label:'Mgmt Report',    icon:FileBarChart2},
  {to:'/finance/config',       label:'Configuration',  icon:Cog},
];

function FinanceModule({ isActive, handleNav, isExpanded, onToggle }) {
  const isFinanceActive = financeItems.some(i => isActive(i.to));
  return (
    <div style={{marginBottom:4}}>
      <button
        onClick={onToggle}
        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,marginBottom:4,width:'100%',border:'none',cursor:'pointer',fontSize:14,fontWeight:isFinanceActive?600:500,color:isFinanceActive?'var(--text)':'var(--text2)',background:isFinanceActive?'var(--bg3)':'transparent',textAlign:'left',transition:'background 0.2s, color 0.2s'}}
      >
        <TrendingUp size={18} style={{opacity:0.8}}/>
        <span style={{flex:1}}>Finance</span>
        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden'
        }}
      >
        <div style={{ minHeight: 0, paddingLeft: 16 }}>
          {financeItems.map(i => (
            <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav}/>
          ))}
        </div>
      </div>
    </div>
  );
}

const expenseSubItems = [
  {to:'/expenses/dashboard', label:'Dashboard',      icon:LayoutDashboard},
  {to:'/expenses/my',        label:'My Expenses',    icon:Receipt},
  {to:'/expenses/approvals', label:'Approvals',      icon:CheckSquare},
  {to:'/expenses/configurations', label:'Configurations', icon:SlidersHorizontal, adminOnly: true},
];

function ExpensesModule({ isActive, handleNav, isExpanded, onToggle }) {
  const { user } = useAuth();

  const filteredItems = expenseSubItems.filter(i => {
    if (i.adminOnly) return !!user?.is_superadmin;
    if (i.to === '/expenses/approvals') return !!user?.is_superadmin || !!user?.is_manager;
    return true;
  });

  const isExpensesActive = filteredItems.some(i => isActive(i.to));
  return (
    <div style={{marginBottom: 4}}>
      <button
        onClick={onToggle}
        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,marginBottom:4,width:'100%',border:'none',cursor:'pointer',fontSize:14,fontWeight:isExpensesActive?600:500,color:isExpensesActive?'var(--text)':'var(--text2)',background:isExpensesActive?'var(--bg3)':'transparent',textAlign:'left',transition:'background 0.2s, color 0.2s'}}
      >
        <Receipt size={18} style={{opacity:0.8}}/>
        <span style={{flex:1}}>Expenses & Reimb.</span>
        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden'
        }}
      >
        <div style={{ minHeight: 0, paddingLeft: 16 }}>
          {filteredItems.map(i => (
            <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav}/>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen, onClose, onToggleSidebar }) {

  const { user, logout } = useAuth();
  const location = useLocation();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const getInitialModule = (path) => {
    if (path.startsWith('/hr')) return 'hr';
    if (path.startsWith('/expenses')) return 'expenses';
    if (path.startsWith('/finance')) return 'finance';
    return null;
  };

  const [openModule, setOpenModule] = useState(() => getInitialModule(location.pathname));

  useEffect(() => {
    const mod = getInitialModule(location.pathname);
    setOpenModule(mod);
  }, [location.pathname]);

  const handleModuleToggle = (modKey) => {
    setOpenModule(prev => prev === modKey ? null : modKey);
  };
  
  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to) && to !== '/';
  const handleNav = () => { if (window.innerWidth <= 768) onClose(); };
  
  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`} style={{display:'flex', flexDirection:'column', height: '100vh', borderRight: '1px solid var(--border)', background: 'var(--bg)'}}>
      <div className="sidebar-header" style={{padding:'24px 20px', display:'flex', alignItems:'center', gap:12}}>
        <img src="/favicon.png" style={{width:32, height:32, objectFit:'contain'}} alt="Logo" />
        <span style={{color:'var(--text)', fontSize:20, fontWeight:700, letterSpacing:'-0.5px'}}>KIM ERP</span>
      </div>
      
      <div className="sidebar-nav" style={{flex:1, padding:'10px 16px', overflowY:'auto'}}>
        <div style={{marginBottom:24}}>
          {mainItems.map(i => (
            <div key={i.to} style={{ display: 'flex', alignItems: 'center' }}>
              <Link
                to={i.to}
                onClick={handleNav}
                className={`nav-item ${isActive(i.to) ? 'active' : ''}`}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 4,
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: isActive(i.to) ? 600 : 500,
                  color: isActive(i.to) ? '#ffffff' : 'var(--text2)',
                  background: isActive(i.to) ? 'var(--accent)' : 'transparent',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={e => { if (!isActive(i.to)) { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text)'; } }}
                onMouseLeave={e => { if (!isActive(i.to)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; } }}
              >
                <i.icon size={18} style={{ opacity: isActive(i.to) ? 1 : 0.8 }} />
                <span style={{ flex: 1 }}>{i.label}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onToggleSidebar) onToggleSidebar();
                    else if (onClose) onClose();
                  }}
                  title="Toggle Sidebar"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: isActive(i.to) ? '#ffffff' : 'var(--text2)',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 4,
                    transition: 'background 0.2s, color 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = isActive(i.to) ? 'rgba(255,255,255,0.25)' : 'var(--border)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Menu size={18} />
                </button>
              </Link>
            </div>
          ))}
        </div>
        
        <div style={{marginBottom:24}}>
          <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text3)', fontWeight:700, marginBottom:12, paddingLeft:14}}>Modules</div>
          {moduleItems.filter(i => {
            const isActiveGlobally = user?.active_modules?.includes(i.key);
            if (!isActiveGlobally) return false;
            if (user?.is_superadmin) return true;
            const p = user?.module_permissions?.[i.key];
            return p && (p.can_read || p.can_create || p.can_edit || p.can_delete);
          }).map(i => <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav} />)}
          {user?.active_modules?.includes('hr') && (
            <HRModule
              isActive={isActive}
              handleNav={handleNav}
              isExpanded={openModule === 'hr'}
              onToggle={() => handleModuleToggle('hr')}
            />
          )}
          {user?.active_modules?.includes('expenses') && (
            <ExpensesModule
              isActive={isActive}
              handleNav={handleNav}
              isExpanded={openModule === 'expenses'}
              onToggle={() => handleModuleToggle('expenses')}
            />
          )}
        </div>
        
        {user?.is_superadmin && (
          <div>
            {user?.active_modules?.includes('finance') && (
              <FinanceModule
                isActive={isActive}
                handleNav={handleNav}
                isExpanded={openModule === 'finance'}
                onToggle={() => handleModuleToggle('finance')}
              />
            )}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text3)', fontWeight:700, marginBottom:12, paddingLeft:14}}>Admin</div>
              {adminItems.filter(i => {
                if (i.to === '/studio') {
                  return user?.active_modules?.includes('studio');
                }
                return true;
              }).map(i => <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav}/>)}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer" style={{padding:'16px', borderTop:'1px solid var(--border)'}}>
        <button className="btn btn-ghost" onClick={() => { logout(); handleNav(); }} style={{width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8, background:'transparent', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:14, fontWeight:600}} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)'}}>
          <LogOut size={18} /> Logout
        </button>
        {user?.name && (
          <div 
            onClick={() => setShowProfileModal(true)}
            style={{display:'flex', alignItems:'center', gap:10, padding:'8px 14px 2px 14px', cursor: 'pointer', transition: 'all 0.2s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)'; e.currentTarget.style.borderRadius='8px';}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}
            title="Open Profile Settings"
          >
            <div style={{width:28, height:28, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13, flexShrink:0}}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{user.name}</div>
              <div style={{fontSize:11, color:'var(--text3)', marginTop:1}}>{user.is_superadmin ? 'Admin' : 'Employee'}</div>
            </div>
          </div>
        )}
      </div>

      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 480, maxWidth: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', animation: 'modalSlideIn 0.25s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Profile Settings</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}><X size={18} /></button>
            </div>
            
            {/* User details card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg2)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', border: '1.5px solid var(--accent)', padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                {user.is_superadmin ? 'Admin' : 'Employee'}
              </span>
            </div>

            {/* 2FA Setup Panel */}
            <TwoFactorSetup />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-primary" onClick={() => setShowProfileModal(false)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}>Close</button>
            </div>
          </div>
          <style>{`
            @keyframes modalSlideIn {
              from { opacity: 0; transform: scale(0.95) translateY(10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </aside>
  );
}

