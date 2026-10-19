'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown, faArrowRightFromBracket, faArrowTrendUp, faCalendarDays,
  faCheck, faChevronLeft, faChevronRight, faCircleCheck, faCircleUser,
  faClock, faEllipsis, faGaugeHigh, faGlobe, faLock,
  faMagnifyingGlass, faShieldHalved, faUserCheck, faUserGroup, faUserPlus,
  faUsers, faXmark,
} from '@fortawesome/free-solid-svg-icons';

type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  provider: string;
  emailVerified?: boolean;
  isActive?: boolean;
  createdAt?: string;
  picture?: string;
};
type ActivityRow = {
  _id?: string;
  activity: string;
  provider?: string;
  createdAt?: string;
  user?: { name?: string; email?: string } | null;
  browser?: string;
};
type Overview = {
  metrics: { totalUsers: number; activeUsers: number; newToday: number; signupsLast30Days: number };
  signupsByDay: { date: string; count: number }[];
  providers: { provider: string; count: number }[];
  recentUsers: UserRow[];
  recentActivity: ActivityRow[];
};
type PageData = { items: UserRow[]; pagination: { page: number; limit: number; total: number; pages: number } };
type Detail = { user: UserRow & { updatedAt?: string; locale?: string }; activities: ActivityRow[] };
type AuditRow = { actor: string; action: string; targetUserId: string; createdAt: string };

const API = (process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data as T;
}

function initials(name?: string, email?: string) {
  const value = name?.trim() || email?.split('@')[0] || 'U';
  return value.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}
function prettyName(value?: string) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function dateLabel(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}
function relativeTime(value?: string) {
  if (!value) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function AdminHome() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [view, setView] = useState<'overview' | 'users' | 'audit'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<PageData | null>(null);
  const [audit, setAudit] = useState<{ items: AuditRow[]; pagination: PageData['pagination'] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  useEffect(() => {
    request<{ status: boolean; email: string }>('/admin/auth/session')
      .then((result) => { setEmail(result.email); setAuthenticated(true); })
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  const loadOverview = useCallback(async () => {
    setBusy(true); setError('');
    try { setOverview(await request<Overview>('/admin/overview')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load the overview.'); }
    finally { setBusy(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setBusy(true); setError('');
    const query = new URLSearchParams({ page: String(page), limit: '8' });
    if (searchQuery) query.set('search', searchQuery);
    if (statusFilter !== 'all') query.set('status', statusFilter);
    if (providerFilter !== 'all') query.set('provider', providerFilter);
    try { setUsers(await request<PageData>(`/admin/users?${query.toString()}`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load users.'); }
    finally { setBusy(false); }
  }, [page, providerFilter, searchQuery, statusFilter]);

  const loadAudit = useCallback(async () => {
    setBusy(true); setError('');
    try { setAudit(await request(`/admin/audit?page=${page}&limit=10`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load audit events.'); }
    finally { setBusy(false); }
  }, [page]);

  useEffect(() => {
    if (!authenticated) return;
    if (view === 'overview') void loadOverview();
    if (view === 'users') void loadUsers();
    if (view === 'audit') void loadAudit();
  }, [authenticated, view, loadOverview, loadUsers, loadAudit]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setSearchQuery(search.trim()); }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoginError(''); setLoginBusy(true);
    try {
      await request('/admin/auth/login', { method: 'POST', body: JSON.stringify({ email: loginEmail, password }) });
      setEmail(loginEmail.trim().toLowerCase()); setAuthenticated(true); setPassword(''); setView('overview');
    } catch (err) { setLoginError(err instanceof Error ? err.message : 'Sign in failed. Please try again.'); }
    finally { setLoginBusy(false); }
  };

  const signOut = async () => {
    try { await request('/admin/auth/logout', { method: 'POST' }); } catch { /* Clear local state even if the network is unavailable. */ }
    setAuthenticated(false); setEmail(''); setOverview(null); setUsers(null); setAudit(null); setSelectedUser(null);
  };

  const openUser = async (id: string) => {
    setDetailBusy(true); setSelectedUser(null);
    try { setSelectedUser(await request<Detail>(`/admin/users/${encodeURIComponent(id)}`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to open this account.'); }
    finally { setDetailBusy(false); }
  };

  const changeStatus = async (user: UserRow) => {
    const action = user.isActive === false ? 'restore access for' : 'disable access for';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name || user.email || 'this account'}? Existing sessions may remain active until their current token expires.`)) return;
    setBusy(true); setError('');
    try {
      await request(`/admin/users/${encodeURIComponent(user._id)}/active/${user.isActive === false ? 'true' : 'false'}`, { method: 'PATCH' });
      if (selectedUser?.user._id === user._id) setSelectedUser(await request<Detail>(`/admin/users/${encodeURIComponent(user._id)}`));
      if (view === 'users') await loadUsers();
      if (view === 'overview') await loadOverview();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update the account.'); }
    finally { setBusy(false); }
  };

  if (checking) return <main className="login-page"><div className="login-card"><div className="skeleton" style={{ height: 34, width: 170 }} /><div className="skeleton" style={{ height: 18, width: 225, marginTop: 30 }} /><div className="skeleton" style={{ height: 42, marginTop: 20 }} /><div className="skeleton" style={{ height: 42, marginTop: 12 }} /></div></main>;

  if (!authenticated) return <main className="login-page">
    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand"><div className="brand-mark">S</div><div><div className="brand-name" style={{ color: '#1c3041' }}>StratVeda</div><div className="brand-sub" style={{ color: '#86939e' }}>Revenue operations</div></div></div>
      <div className="eyebrow">Administrator access</div>
      <h1 className="login-title" id="login-title">Welcome back</h1>
      <p className="login-caption">Sign in to manage accounts and review platform activity.</p>
      {loginError && <div className="error-banner" role="alert">{loginError}</div>}
      <form className="login-form" onSubmit={submitLogin}>
        <div className="form-field"><label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" required maxLength={254} placeholder="you@company.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required maxLength={256} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <button className="primary-button login-submit" type="submit" disabled={loginBusy}>{loginBusy ? <><span className="spinner" />Signing in…</> : <>Sign in <FontAwesomeIcon icon={faArrowDown} rotation={270} /></>}</button>
      </form>
      <div className="login-foot"><FontAwesomeIcon icon={faLock} /> Secure administrator session</div>
      <div className="login-note">Access is limited to authorized administrators.</div>
    </section>
  </main>;

  return <div className="shell">
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand"><div className="brand-mark">S</div><div className="brand-copy"><div className="brand-name">StratVeda</div><div className="brand-sub">RevOps console</div></div></div>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list">
        <button className={`nav-item ${view === 'overview' ? 'active' : ''}`} onClick={() => { setView('overview'); setPage(1); }}><span className="nav-icon"><FontAwesomeIcon icon={faGaugeHigh} /></span><span>Overview</span></button>
        <button className={`nav-item ${view === 'users' ? 'active' : ''}`} onClick={() => { setView('users'); setPage(1); }}><span className="nav-icon"><FontAwesomeIcon icon={faUsers} /></span><span>Users</span></button>
        <button className={`nav-item ${view === 'audit' ? 'active' : ''}`} onClick={() => { setView('audit'); setPage(1); }}><span className="nav-icon"><FontAwesomeIcon icon={faShieldHalved} /></span><span>Admin activity</span></button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="workspace-card"><div className="workspace-heading">Environment</div><div className="workspace-status"><span className="pulse" />Development</div><p className="workspace-note">All systems operational</p></div>
      <div className="sidebar-footer"><div className="avatar">{initials(email)}</div><div className="footer-copy"><div className="footer-name">{email}</div><div className="footer-role">Administrator</div></div></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="breadcrumb"><span>RevOps</span><span>/</span><strong>{view === 'overview' ? 'Overview' : view === 'users' ? 'Users' : 'Admin activity'}</strong></div>
        <div className="top-actions"><div className="top-divider" /><div className="top-profile"><div className="avatar">{initials(email)}</div><div><div className="profile-email">{email}</div><div className="profile-caption">Administrator</div></div></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><FontAwesomeIcon icon={faArrowRightFromBracket} /></button></div>
      </header>

      <div className="content">
        {error && <div className="error-banner" role="alert">{error}</div>}
        {view === 'overview' && <OverviewView overview={overview} busy={busy} onViewUsers={() => setView('users')} onOpenUser={openUser} />}
        {view === 'users' && <UsersView data={users} busy={busy} search={search} setSearch={setSearch} status={statusFilter} setStatus={(value) => { setStatusFilter(value); setPage(1); }} provider={providerFilter} setProvider={(value) => { setProviderFilter(value); setPage(1); }} page={page} setPage={setPage} onOpenUser={openUser} onToggleStatus={changeStatus} />}
        {view === 'audit' && <AuditView data={audit} busy={busy} page={page} setPage={setPage} />}
      </div>
    </main>

    {(detailBusy || selectedUser) && <UserDrawer detail={selectedUser} loading={detailBusy} onClose={() => { setSelectedUser(null); setDetailBusy(false); }} onToggleStatus={changeStatus} />}
  </div>;
}

function OverviewView({ overview, busy, onViewUsers, onOpenUser }: { overview: Overview | null; busy: boolean; onViewUsers: () => void; onOpenUser: (id: string) => void }) {
  const metrics = overview?.metrics;
  return <>
    <div className="heading-row"><div><div className="eyebrow">Your platform at a glance</div><h1 className="page-title">Good day, Admin</h1><p className="page-description">Here&apos;s what&apos;s happening across your RevOps workspace.</p></div><div className="date-chip"><FontAwesomeIcon icon={faCalendarDays} /> Last 30 days</div></div>
    <div className="metrics-grid">
      <Metric label="Total users" value={metrics?.totalUsers} foot="All registered accounts" icon={faUserGroup} tone="teal" />
      <Metric label="Active accounts" value={metrics?.activeUsers} foot="Currently enabled" icon={faUserCheck} tone="green" />
      <Metric label="New today" value={metrics?.newToday} foot="Accounts created today" icon={faUserPlus} tone="blue" />
      <Metric label="Signups this month" value={metrics?.signupsLast30Days} foot="Last 30 days" icon={faArrowTrendUp} tone="amber" />
    </div>
    <div className="content-grid">
      <section className="panel" aria-labelledby="signup-title"><div className="panel-head"><div><h2 className="panel-title" id="signup-title">User growth</h2><p className="panel-subtitle">New accounts created over the last 30 days</p></div><span className="date-chip"><span className="pulse" style={{ width: 6, height: 6 }} /> Signups</span></div>{overview ? <SignupChart data={overview.signupsByDay} /> : <div className="chart-wrap"><div className="skeleton" style={{ height: 180 }} /></div>}<div className="legend-row"><span>Daily signups</span><span>{metrics?.signupsLast30Days ?? '—'} total</span></div></section>
      <section className="panel" aria-labelledby="provider-title"><div className="panel-head"><div><h2 className="panel-title" id="provider-title">Sign-in methods</h2><p className="panel-subtitle">How users access their accounts</p></div></div>{overview ? <div className="provider-content"><div className="provider-total"><strong>{metrics?.totalUsers ?? 0}</strong><span>registered accounts</span></div><div className="provider-list">{['google', 'microsoft', 'linkedin', 'password'].map((name) => { const count = overview.providers.find((entry) => entry.provider === name)?.count ?? 0; const percent = metrics?.totalUsers ? Math.round(count / metrics.totalUsers * 100) : 0; return <div className="provider-row" key={name}><span className="provider-name">{prettyName(name)}</span><div className="provider-track" aria-label={`${percent}% ${name}`}><div className="provider-fill" style={{ width: `${percent}%` }} /></div><span className="provider-count">{count}</span></div>; })}</div></div> : <div className="provider-content"><div className="skeleton" style={{ height: 155 }} /></div>}</section>
    </div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="toolbar-left"><div><h2 className="panel-title">Recently joined</h2><p className="panel-subtitle">The latest accounts added to your workspace</p></div></div><button className="secondary-button" onClick={onViewUsers}>View all users <FontAwesomeIcon icon={faArrowRightFromBracket} rotation={180} /></button></div>{busy && !overview ? <div className="loading-card">Loading workspace activity…</div> : <UserTable rows={overview?.recentUsers ?? []} onOpenUser={onOpenUser} />}</section>
    <div className="bottom-grid"><RecentActivity items={overview?.recentActivity ?? []} /><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Account health</h2><p className="panel-subtitle">Access and security snapshot</p></div></div><div className="activity-list"><HealthLine icon={faCircleCheck} title="Secure admin session" detail="Protected with a short-lived, HTTP-only cookie" tone="login" /><HealthLine icon={faGlobe} title="User access controls" detail="Account status is checked at sign-in" tone="login" /><HealthLine icon={faShieldHalved} title="Admin audit trail" detail="Account changes are recorded for review" tone="login" /></div></section></div>
  </>;
}

function Metric({ label, value, foot, icon, tone }: { label: string; value?: number; foot: string; icon: typeof faUsers; tone: string }) {
  return <section className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}><FontAwesomeIcon icon={icon} /></span></div><div className="metric-value">{value === undefined ? <span className="skeleton" style={{ display: 'inline-block', width: 62, height: 27 }} /> : value.toLocaleString('en')}</div><div className="metric-foot"><span>{foot}</span></div></section>;
}

function SignupChart({ data }: { data: Overview['signupsByDay'] }) {
  const max = Math.max(4, ...data.map((item) => item.count));
  const points = data.map((item, index) => ({ x: 42 + index * (670 / Math.max(1, data.length - 1)), y: 165 - (item.count / max) * 132 }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${points.at(-1)?.x ?? 712} 172 L 42 172 Z`;
  const labelAt = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((value, index, all) => all.indexOf(value) === index);
  return <div className="chart-wrap"><svg className="chart-svg" viewBox="0 0 740 205" role="img" aria-label="Daily account signups for the last 30 days">
    <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#16877e" stopOpacity=".18" /><stop offset="100%" stopColor="#16877e" stopOpacity=".015" /></linearGradient></defs>
    {[34, 78, 122, 166].map((y) => <line key={y} className="chart-gridline" x1="38" x2="717" y1={y} y2={y} />)}
    <text className="chart-label" x="7" y="37">{max}</text><text className="chart-label" x="7" y="81">{Math.round(max * .67)}</text><text className="chart-label" x="7" y="125">{Math.round(max * .33)}</text><text className="chart-label" x="14" y="169">0</text>
    <path className="chart-area" d={area} /><path className="chart-line" d={line} />
    {points.length > 0 && <circle className="chart-dot" cx={points.at(-1)!.x} cy={points.at(-1)!.y} r="4" />}
    {labelAt.map((index) => <text key={index} className="chart-label" textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} x={points[index]?.x ?? 42} y="193">{data[index]?.date ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${data[index].date}T00:00:00`)) : ''}</text>)}
  </svg></div>;
}

function UsersView({ data, busy, search, setSearch, status, setStatus, provider, setProvider, page, setPage, onOpenUser, onToggleStatus }: { data: PageData | null; busy: boolean; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; provider: string; setProvider: (value: string) => void; page: number; setPage: (value: number) => void; onOpenUser: (id: string) => void; onToggleStatus: (user: UserRow) => void }) {
  return <><div className="heading-row"><div><div className="eyebrow">People and access</div><h1 className="page-title">Users</h1><p className="page-description">Search accounts, review sign-in activity, and manage access.</p></div><div className="date-chip"><FontAwesomeIcon icon={faUsers} /> {data?.pagination.total.toLocaleString('en') ?? '—'} accounts</div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="toolbar-left"><div className="table-tabs" role="tablist" aria-label="Filter users by account status"><button className={`table-tab ${status === 'all' ? 'selected' : ''}`} onClick={() => setStatus('all')}>All <span className="count">{data?.pagination.total ?? '—'}</span></button><button className={`table-tab ${status === 'active' ? 'selected' : ''}`} onClick={() => setStatus('active')}>Active</button><button className={`table-tab ${status === 'inactive' ? 'selected' : ''}`} onClick={() => setStatus('inactive')}>Inactive</button></div><label className="search-box"><FontAwesomeIcon icon={faMagnifyingGlass} /><input aria-label="Search users" placeholder="Search name or email…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="filter-select" aria-label="Filter by sign-in method" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="all">All methods</option><option value="google">Google</option><option value="microsoft">Microsoft</option><option value="linkedin">LinkedIn</option><option value="password">Password</option></select></div></div>
      {busy && !data ? <div className="loading-card">Loading users…</div> : <UserTable rows={data?.items ?? []} onOpenUser={onOpenUser} onToggleStatus={onToggleStatus} showJoined={true} />}
      {data && <Pagination page={page} pages={data.pagination.pages} total={data.pagination.total} limit={data.pagination.limit} onPage={setPage} />}
    </section>
  </>;
}

function UserTable({ rows, onOpenUser, onToggleStatus, showJoined = false }: { rows: UserRow[]; onOpenUser: (id: string) => void; onToggleStatus?: (user: UserRow) => void; showJoined?: boolean }) {
  return <div className="table-wrap"><table className="users-table"><thead><tr><th scope="col">User</th><th scope="col">Sign-in method</th><th scope="col">Status</th>{showJoined && <th scope="col">Joined</th>}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((user) => <tr key={user._id}>
    <td><button className="user-cell" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left' }} onClick={() => onOpenUser(user._id)}><span className="user-avatar">{initials(user.name, user.email)}</span><span><span className="user-name">{user.name || 'Unnamed user'}</span><span className="user-email">{user.email || 'No email on file'}</span></span></button></td>
    <td><span className="provider-pill"><FontAwesomeIcon icon={user.provider === 'password' ? faLock : faGlobe} /> {prettyName(user.provider)}</span></td>
    <td><span className={`status ${user.isActive === false ? 'inactive' : 'active'}`}><span className="status-dot" />{user.isActive === false ? 'Inactive' : 'Active'}</span></td>
    {showJoined && <td>{dateLabel(user.createdAt)}</td>}
    <td><button className="row-menu" aria-label={`Open ${user.name || user.email || 'user'} details`} onClick={() => onOpenUser(user._id)}><FontAwesomeIcon icon={faEllipsis} /></button></td>
  </tr>)}{rows.length === 0 && <tr><td colSpan={showJoined ? 5 : 4} className="table-empty">No matching accounts. Try adjusting your search or filters.</td></tr>}</tbody></table></div>;
}

function Pagination({ page, pages, total, limit, onPage }: { page: number; pages: number; total: number; limit: number; onPage: (value: number) => void }) {
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, total);
  return <div className="table-footer"><span>Showing {start}–{end} of {total.toLocaleString('en')} accounts</span><div className="pagination"><button className="page-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><FontAwesomeIcon icon={faChevronLeft} /></button><span className="page-btn current" aria-current="page">{pages ? page : 0}</span><button className="page-btn" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><FontAwesomeIcon icon={faChevronRight} /></button></div></div>;
}

function RecentActivity({ items }: { items: ActivityRow[] }) {
  return <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Recent sign-ins</h2><p className="panel-subtitle">The latest account activity</p></div><span className="date-chip"><FontAwesomeIcon icon={faClock} /> Live</span></div><div className="activity-list">{items.length ? items.slice(0, 5).map((item, index) => <div className="activity-item" key={item._id || `${item.activity}-${index}`}><div className={`activity-mark ${item.activity === 'login' ? 'login' : ''}`}><FontAwesomeIcon icon={item.activity === 'signup' ? faUserPlus : faCircleUser} /></div><div className="activity-copy"><strong>{item.user?.name || item.user?.email || 'A user'}</strong> {item.activity === 'signup' ? 'created an account' : item.activity === 'logout' ? 'signed out' : 'signed in'}<div style={{ color: '#95a0aa', marginTop: 2 }}>via {prettyName(item.provider)}</div></div><span className="activity-time">{relativeTime(item.createdAt)}</span></div>) : <div className="audit-empty">No recent sign-ins to show yet.</div>}</div></section>;
}

function HealthLine({ icon, title, detail, tone }: { icon: typeof faCheck; title: string; detail: string; tone: string }) {
  return <div className="activity-item"><div className={`activity-mark ${tone}`}><FontAwesomeIcon icon={icon} /></div><div className="activity-copy"><strong>{title}</strong><div style={{ color: '#89949f', marginTop: 2 }}>{detail}</div></div><FontAwesomeIcon icon={faCheck} style={{ color: '#399671', fontSize: 11 }} /></div>;
}

function AuditView({ data, busy, page, setPage }: { data: { items: AuditRow[]; pagination: PageData['pagination'] } | null; busy: boolean; page: number; setPage: (value: number) => void }) {
  return <><div className="heading-row"><div><div className="eyebrow">Security and accountability</div><h1 className="page-title">Admin activity</h1><p className="page-description">A reviewable record of account access changes made in this console.</p></div><div className="date-chip"><FontAwesomeIcon icon={faShieldHalved} /> Audit history</div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div><h2 className="panel-title">Account changes</h2><p className="panel-subtitle">Activation and deactivation actions</p></div></div><div className="table-wrap"><table className="users-table"><thead><tr><th scope="col">Action</th><th scope="col">Administrator</th><th scope="col">User ID</th><th scope="col">Date</th></tr></thead><tbody>{data?.items.map((item, index) => <tr key={`${item.createdAt}-${index}`}><td><span className={`status ${item.action.endsWith('deactivated') ? 'inactive' : 'active'}`}><span className="status-dot" />{item.action.endsWith('deactivated') ? 'Access disabled' : 'Access restored'}</span></td><td>{item.actor}</td><td style={{ fontVariantNumeric: 'tabular-nums' }}>{item.targetUserId}</td><td>{dateLabel(item.createdAt)} · {new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(item.createdAt))}</td></tr>)}{!data?.items.length && <tr><td colSpan={4} className="table-empty">{busy ? 'Loading audit history…' : 'No account access changes have been recorded yet.'}</td></tr>}</tbody></table></div>{data && <Pagination page={page} pages={data.pagination.pages} total={data.pagination.total} limit={data.pagination.limit} onPage={setPage} />}</section>
  </>;
}

function UserDrawer({ detail, loading, onClose, onToggleStatus }: { detail: Detail | null; loading: boolean; onClose: () => void; onToggleStatus: (user: UserRow) => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div className="drawer-head"><h2 className="drawer-heading" id="drawer-title">User details</h2><button className="icon-button" onClick={onClose} aria-label="Close user details"><FontAwesomeIcon icon={faXmark} /></button></div>{loading || !detail ? <div className="drawer-body"><div className="skeleton" style={{ height: 56 }} /><div className="skeleton" style={{ height: 85, marginTop: 17 }} /><div className="skeleton" style={{ height: 180, marginTop: 18 }} /></div> : <div className="drawer-body"><div className="detail-profile"><div className="avatar large">{initials(detail.user.name, detail.user.email)}</div><div><div className="detail-name">{detail.user.name || 'Unnamed user'}</div><div className="detail-email">{detail.user.email || 'No email on file'}</div></div></div><div className="detail-grid"><DetailField label="Account status" value={detail.user.isActive === false ? 'Inactive' : 'Active'} /><DetailField label="Sign-in method" value={prettyName(detail.user.provider)} /><DetailField label="Email verified" value={detail.user.emailVerified ? 'Yes' : 'Not confirmed'} /><DetailField label="Joined" value={dateLabel(detail.user.createdAt)} /><DetailField label="Last profile update" value={dateLabel(detail.user.updatedAt)} /><DetailField label="Locale" value={detail.user.locale || 'Not provided'} /></div><h3 className="drawer-subhead">Recent activity</h3>{detail.activities.length ? detail.activities.slice(0, 15).map((activity, index) => <div className="detail-activity" key={activity._id || `${activity.activity}-${index}`}><FontAwesomeIcon icon={activity.activity === 'signup' ? faUserPlus : faCircleUser} style={{ color: '#2f8379' }} /><span>{prettyName(activity.activity)} · {prettyName(activity.provider)}</span><span className="activity-time">{relativeTime(activity.createdAt)}</span></div>) : <div className="audit-empty" style={{ margin: '0' }}>No sign-in activity recorded.</div>}<div className="detail-actions"><button className={detail.user.isActive === false ? 'primary-button' : 'danger-button'} onClick={() => onToggleStatus(detail.user)}>{detail.user.isActive === false ? <><FontAwesomeIcon icon={faCircleCheck} /> Restore access</> : <><FontAwesomeIcon icon={faArrowDown} /> Disable access</>}</button></div></div>}</aside></div>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div className="detail-field"><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>;
}
