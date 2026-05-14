import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, Wrench, Settings, LogOut, ClipboardList, Package, ShieldCheck, HeartPulse, Database, UserSquare, Clock, FileText, CheckSquare, DollarSign, SlidersHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const mainItems = [{to:'/',label:'Dashboard',icon:LayoutDashboard}];
const moduleItems = [
  {to:'/crm',label:'CRM',icon:Users,key:'crm'},
  {to:'/installation',label:'KIM Installation',icon:Wrench,key:'installation'},
  {to:'/service',label:'Service',icon:ClipboardList,key:'service'},
  {to:'/warranty/products',label:'Product & Warranty',icon:ShieldCheck,key:'warranty'},
  {to:'/konwertcare',label:'Konwert Care+',icon:HeartPulse,key:'konwertcare'}
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
  {to:'/warranty/bom',label:'BOM Master',icon:Package},
  {to:'/studio',label:'Studio',icon:Settings},
  {to:'/admin/backups',label:'System Backup',icon:Database},
  {to:'/audit',label:'Audit Log',icon:ClipboardList}
];


const NavItem=({to,label,icon:Icon,active,onClick})=>(<Link to={to} onClick={onClick} className={`nav-item ${active?'active':''}`} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,marginBottom:4,textDecoration:'none',fontSize:14,fontWeight:active?600:500,color:active?'#ffffff':'var(--text2)',background:active?'var(--accent)':'transparent'}} onMouseEnter={e=>{if(!active){e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)';}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)';}}}><Icon size={18} style={{opacity:active?1:0.8}}/>{label}</Link>);

function HRModule({ isActive, handleNav }) {
  const [expanded, setExpanded] = useState(true);
  const isHRActive = hrSubItems.some(i => isActive(i.to));
  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,marginBottom:4,width:'100%',border:'none',cursor:'pointer',fontSize:14,fontWeight:isHRActive?600:500,color:isHRActive?'var(--text)':'var(--text2)',background:isHRActive?'var(--bg3)':'transparent',textAlign:'left'}}
      >
        <Clock size={18} style={{opacity:0.8}}/>
        <span style={{flex:1}}>Attendance & HR</span>
        {expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
      </button>
      {expanded && (
        <div style={{paddingLeft:16}}>
          {hrSubItems.map(i => (
            <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav}/>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to) && to !== '/';
  const handleNav = () => { if (window.innerWidth <= 768) onClose(); };
  
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{display:'flex', flexDirection:'column', height: '100vh', borderRight: '1px solid var(--border)', background: 'var(--bg)'}}>
      <div className="sidebar-header" style={{padding:'24px 20px', display:'flex', alignItems:'center', gap:12}}>
        <div style={{width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyCenter:'center', color:'white', fontWeight:'bold', fontSize:16, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>K</div>
        <span style={{color:'var(--text)', fontSize:20, fontWeight:700, letterSpacing:'-0.5px'}}>KIM ERP</span>
      </div>
      
      <div className="sidebar-nav" style={{flex:1, padding:'10px 16px', overflowY:'auto'}}>
        <div style={{marginBottom:24}}>
          {mainItems.map(i => <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav}/>)}
        </div>
        
        <div style={{marginBottom:24}}>
          <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text3)', fontWeight:700, marginBottom:12, paddingLeft:14}}>Modules</div>
          {moduleItems.filter(i => {
            if (user?.is_superadmin) return true;
            const p = user?.module_permissions?.[i.key];
            return p && (p.can_read || p.can_create || p.can_edit || p.can_delete);
          }).map(i => <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav} />)}
          <HRModule isActive={isActive} handleNav={handleNav} />
        </div>
        
        {user?.is_superadmin && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text3)', fontWeight:700, marginBottom:12, paddingLeft:14}}>Admin</div>
            {adminItems.map(i => <NavItem key={i.to} {...i} active={isActive(i.to)} onClick={handleNav}/>)}
          </div>
        )}
      </div>

      <div className="sidebar-footer" style={{padding:'16px', borderTop:'1px solid var(--border)'}}>
        <button className="btn btn-ghost" onClick={() => { logout(); handleNav(); }} style={{width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8, background:'transparent', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:14, fontWeight:600}} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)'}}>
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
