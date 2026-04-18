import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, Wrench,  Settings, LogOut, Layers, Shield, GitBranch, ClipboardList, Package, ShieldCheck, HeartPulse } from 'lucide-react';

const mainItems = [{to:'/',label:'Dashboard',icon:LayoutDashboard}];
const moduleItems = [
  {to:'/crm',label:'CRM',icon:Users,key:'crm'},
  {to:'/installation',label:'KIM Installation',icon:Wrench,key:'installation'},
  {to:'/service',label:'Service',icon:ClipboardList,key:'service'},
  {to:'/warranty/products',label:'Product & Warranty',icon:ShieldCheck,key:'warranty'},
  {to:'/konwertcare',label:'Konwert Care+',icon:HeartPulse,key:'konwertcare'}
];
const adminItems = [
  {to:'/admin/users',label:'User Management',icon:Users},
  {to:'/warranty/bom',label:'BOM Master',icon:Package},
  {to:'/studio',label:'Studio',icon:Settings},
  {to:'/audit',label:'Audit Log',icon:ClipboardList}
];

const NavItem=({to,label,icon:Icon,active})=>(<Link to={to} className={`nav-item ${active?'active':''}`} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:8,marginBottom:4,textDecoration:'none',fontSize:14,fontWeight:active?600:500,color:active?'#ffffff':'var(--text2)',background:active?'var(--accent)':'transparent',transition:'all 0.15s'}} onMouseEnter={e=>{if(!active){e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)';}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)';}}}><Icon size={18} style={{opacity:active?1:0.8}}/>{label}</Link>);

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to) && to !== '/';
  
  return (
    <aside className="sidebar" style={{display:'flex', flexDirection:'column', height: '100vh', borderRight: '1px solid var(--border)', background: 'var(--bg)'}}>
      <div className="sidebar-header" style={{padding:'24px 20px', display:'flex', alignItems:'center', gap:12}}>
        <div style={{width:32, height:32, background:'var(--accent)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:16}}>O</div>
        <span style={{color:'var(--text)', fontSize:20, fontWeight:700, letterSpacing:'-0.5px'}}>OmniERP</span>
      </div>
      
      <div className="sidebar-nav" style={{flex:1, padding:'10px 16px', overflowY:'auto'}}>
        <div style={{marginBottom:24}}>
          {mainItems.map(i => <NavItem key={i.to} {...i} active={isActive(i.to)}/>)}
        </div>
        
        <div style={{marginBottom:24}}>
          <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text3)', fontWeight:700, marginBottom:12, paddingLeft:14}}>Modules</div>
          {moduleItems.map(i => <NavItem key={i.to} {...i} active={isActive(i.to)} />)}
        </div>
        
        {user?.is_superadmin && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--text3)', fontWeight:700, marginBottom:12, paddingLeft:14}}>Admin</div>
            {adminItems.map(i => <NavItem key={i.to} {...i} active={isActive(i.to)}/>)}
          </div>
        )}
      </div>

      <div className="sidebar-footer" style={{padding:'16px', borderTop:'1px solid var(--border)'}}>
        <button className="btn btn-ghost" onClick={logout} style={{width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:8, background:'transparent', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:14, fontWeight:600}} onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)'}}>
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
