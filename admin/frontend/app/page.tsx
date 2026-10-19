'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown, faArrowRight, faArrowRightFromBracket, faArrowUpRightFromSquare,
  faBars, faCheck, faChevronLeft, faChevronRight, faCircleCheck,
  faClock, faEllipsis, faFilter, faFingerprint, faGlobe, faMagnifyingGlass,
  faShieldHalved, faSliders, faUser, faUserCheck, faUserPlus, faUsers, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { ApiError, ENV_LABEL, probeHealth, request } from '@/lib/admin-api';

type View = 'overview' | 'users' | 'audit';
type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  provider: string;
  emailVerified?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  picture?: string;
  locale?: string;
};
type ActivityRow = {
  _id?: string;
  activity: string;
  provider?: string;
  createdAt?: string;
  browser?: string;
  operatingSystem?: string;
  devicePlatform?: string;
  user?: { name?: string; email?: string } | null;
};
type Overview = {
  metrics: { totalUsers: number; activeUsers: number; newToday: number; signupsLast30Days: number };
  signupsByDay: { date: string; count: number }[];
  providers: { provider?: string; count: number }[];
  recentUsers: UserRow[];
  recentActivity: ActivityRow[];
};
type PageResult<T> = { items: T[]; pagination: { page: number; limit: number; total: number; pages: number } };
type UserDetail = { user: UserRow; activities: ActivityRow[] };
type AuditRow = {
  actor: string;
  action: string;
  targetUserId: string;
  createdAt: string;
  ipAddress?: string;
  targetName?: string;
  targetEmail?: string;
  targetActive?: boolean | null;
  targetExists: boolean;
};
type AuditResult = PageResult<AuditRow>;

const formatNumber = (value: number) => new Intl.NumberFormat('en').format(value);
const dateLabel = (value?: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', options).format(date);
};
const shortName = (value?: string, email?: string) => {
  const source = value?.trim() || email?.split('@')[0] || 'User';
  return source.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((piece) => piece[0].toUpperCase()).join('');
};
const titleCase = (value?: string) => value ? value.replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Unknown';
const relativeTime = (value?: string) => {
  if (!value) return 'Time not recorded';
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return 'Time not recorded';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function AdminHome() {
  const [view, setView] = useState<View>('overview');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<'checking' | 'ready' | 'down'>('checking');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<PageResult<UserRow> | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [provider, setProvider] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [auditAction, setAuditAction] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const requestSequence = useRef(0);
  const closeUserDrawer = useCallback(() => { setSelectedUser(null); setDetailBusy(false); }, []);

  useEffect(() => {
    request<{ status: boolean; email: string }>('/admin/auth/session')
      .then((result) => { setAdminEmail(result.email); setAuthenticated(true); })
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    const check = () => void probeHealth().then((ok) => { if (alive) setHealth(ok ? 'ready' : 'down'); });
    check();
    const timer = window.setInterval(check, 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [authenticated]);

  const clearPrivateState = useCallback(() => {
    setAuthenticated(false); setAdminEmail(''); setOverview(null); setUsers(null); setAudit(null); setSelectedUser(null);
    setPage(1); setSearch(''); setSearchQuery(''); setStatus('all'); setProvider('all'); setPageSize(10);
    setAuditAction('all'); setAuditSearch(''); setAuditSearchQuery('');
  }, []);

  const handleError = useCallback((reason: unknown, fallback: string) => {
    if (reason instanceof ApiError && reason.status === 401) {
      setLoginError('Your secure session has ended. Sign in again to continue.');
      clearPrivateState();
      return;
    }
    setError(reason instanceof Error ? reason.message : fallback);
  }, [clearPrivateState]);

  const loadOverview = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setBusy(true); setError('');
    try {
      const data = await request<Overview>('/admin/overview');
      if (sequence === requestSequence.current) setOverview(data);
    } catch (reason) { if (sequence === requestSequence.current) handleError(reason, 'The overview could not be loaded.'); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  }, [handleError]);

  const loadUsers = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setBusy(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchQuery) params.set('search', searchQuery);
    if (status !== 'all') params.set('status', status);
    if (provider !== 'all') params.set('provider', provider);
    try {
      const data = await request<PageResult<UserRow>>(`/admin/users?${params.toString()}`);
      if (sequence === requestSequence.current) setUsers(data);
    } catch (reason) { if (sequence === requestSequence.current) handleError(reason, 'The account directory could not be loaded.'); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  }, [handleError, page, pageSize, provider, searchQuery, status]);

  const loadAudit = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setBusy(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (auditAction !== 'all') params.set('action', auditAction);
    if (auditSearchQuery) params.set('search', auditSearchQuery);
    try {
      const data = await request<AuditResult>(`/admin/audit?${params.toString()}`);
      if (sequence === requestSequence.current) setAudit(data);
    } catch (reason) { if (sequence === requestSequence.current) handleError(reason, 'The activity ledger could not be loaded.'); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  }, [auditAction, auditSearchQuery, handleError, page]);

  useEffect(() => {
    if (!authenticated) return;
    if (view === 'overview') void loadOverview();
    if (view === 'users') void loadUsers();
    if (view === 'audit') void loadAudit();
  }, [authenticated, view, loadOverview, loadUsers, loadAudit]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setPage(1); setSearchQuery(search.trim()); }, 260);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setPage(1); setAuditSearchQuery(auditSearch.trim()); }, 260);
    return () => window.clearTimeout(timeout);
  }, [auditSearch]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError(''); setLoginBusy(true);
    try {
      await request('/admin/auth/login', { method: 'POST', body: JSON.stringify({ email: loginEmail.trim(), password }) });
      const result = await request<{ status: boolean; email: string }>('/admin/auth/session');
      setAdminEmail(result.email); setAuthenticated(true); setPassword('');
    } catch (reason) { setLoginError(reason instanceof Error ? reason.message : 'Sign in could not be completed.'); }
    finally { setLoginBusy(false); }
  }

  async function signOut() {
    try { await request('/admin/auth/logout', { method: 'POST' }); } catch { /* Local private state is cleared even if logout cannot reach the API. */ }
    clearPrivateState(); setLoginError(''); setError('');
  }

  async function openUser(id: string) {
    setSelectedUser(null); setDetailBusy(true); setError('');
    try { setSelectedUser(await request<UserDetail>(`/admin/users/${encodeURIComponent(id)}`)); }
    catch (reason) { handleError(reason, 'Account details could not be loaded.'); }
    finally { setDetailBusy(false); }
  }

  const selectedTitle = useMemo(() => ({ overview: 'Overview', users: 'Accounts', audit: 'Activity ledger' })[view], [view]);

  async function toggleAccount(user: UserRow) {
    const disabling = user.isActive !== false;
    const person = user.name?.trim() || user.email || 'this account';
    const message = disabling
      ? `Disable access for ${person}? Their existing session remains valid until it expires.`
      : `Restore access for ${person}? They will be able to sign in again.`;
    if (!window.confirm(message)) return;
    setBusy(true); setError('');
    try {
      await request(`/admin/users/${encodeURIComponent(user._id)}/active/${String(!disabling)}`, { method: 'PATCH' });
      if (selectedUser?.user._id === user._id) setSelectedUser(await request<UserDetail>(`/admin/users/${encodeURIComponent(user._id)}`));
      if (view === 'users') await loadUsers();
      else if (view === 'overview') await loadOverview();
      else await loadAudit();
    } catch (reason) { handleError(reason, 'Account access could not be changed.'); }
    finally { setBusy(false); }
  }

  if (checkingSession) return <main className="signin-stage" aria-busy="true"><section className="signin-panel"><div className="wordmark"><span className="wordmark-mark">S</span><span>stratveda<span className="wordmark-dot">.</span></span></div><p className="kicker">Administrator access</p><h1>Welcome back.</h1><p className="signin-copy">Checking your administrator session…</p><div className="signin-skeleton" /><div className="signin-skeleton short" /></section></main>;

  if (!authenticated) return <main className="signin-stage">
    <section className="signin-poster">
      <div className="poster-top"><div className="wordmark light"><span className="wordmark-mark">S</span><span>stratveda<span className="wordmark-dot">.</span></span></div><span className="poster-tag"><span className="live-dot" /> PRIVATE ENVIRONMENT</span></div>
      <div className="poster-copy"><p className="kicker light-kicker">REVOPS · ADMINISTRATION</p><h1>Clarity for the people behind the numbers.</h1><p>One considered workspace for understanding your user base, reviewing account activity, and managing access responsibly.</p></div>
      <div className="poster-stats"><div><strong>01</strong><span>Understand<br />the user base</span></div><div><strong>02</strong><span>Review<br />account activity</span></div><div><strong>03</strong><span>Manage access<br />with care</span></div></div>
      <div className="poster-orbit orbit-one" /><div className="poster-orbit orbit-two" /><div className="poster-orbit orbit-three" />
      <p className="poster-foot">STRATVEDA <span>·</span> REVENUE OPERATIONS</p>
    </section>
    <section className="signin-panel-wrap"><div className="signin-panel">
      <p className="kicker">ADMINISTRATOR ACCESS</p><h2>Sign in to your workspace</h2><p className="signin-copy">Use the administrator credentials assigned to this environment.</p>
      {loginError && <div className="notice error-notice" role="alert">{loginError}</div>}
      <form className="signin-form" onSubmit={signIn}>
        <label htmlFor="admin-email">Work email</label><div className="input-wrap"><FontAwesomeIcon icon={faUser} /><input id="admin-email" type="email" autoComplete="username" required maxLength={254} placeholder="name@company.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} /></div>
        <label htmlFor="admin-password">Password</label><div className="input-wrap"><FontAwesomeIcon icon={faFingerprint} /><input id="admin-password" type="password" autoComplete="current-password" required maxLength={256} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <button className="button primary signin-button" type="submit" disabled={loginBusy || !loginEmail || !password}>{loginBusy ? 'Signing in…' : <>Enter the console <FontAwesomeIcon icon={faArrowRight} /></>}</button>
      </form>
      <div className="signin-security"><FontAwesomeIcon icon={faShieldHalved} /><span>Protected administrator session</span></div>
    </div><p className="signin-help">Access is limited to authorized administrators. Contact your system owner if you need help signing in.</p></section>
  </main>;

  return <div className="app-frame">
    <header className="topbar">
      <a className="wordmark" href="#overview" onClick={(event) => { event.preventDefault(); setView('overview'); }} aria-label="StratVeda operations home"><span className="wordmark-mark">S</span><span>stratveda<span className="wordmark-dot">.</span></span></a>
      <div className="topbar-divider" />
      <div className="workspace-name"><span className="workspace-eyebrow">REVENUE OPERATIONS</span><span>Administration</span></div>
      <nav className={`primary-nav ${mobileMenuOpen ? 'open' : ''}`} aria-label="Main navigation">
        {(['overview', 'users', 'audit'] as View[]).map((item) => <button key={item} className={`nav-link ${view === item ? 'active' : ''}`} aria-current={view === item ? 'page' : undefined} onClick={() => { setView(item); setPage(1); setMobileMenuOpen(false); }}>{item === 'users' ? 'Accounts' : item === 'audit' ? 'Activity ledger' : 'Overview'}</button>)}
      </nav>
      <div className="topbar-actions"><span className={`service-state ${health}`}><i />{health === 'checking' ? 'Connecting' : health === 'ready' ? 'Services online' : 'Service unavailable'}</span><button className="account-menu" onClick={signOut} aria-label={`Sign out ${adminEmail}`}><span className="account-avatar">{shortName(undefined, adminEmail)}</span><span className="account-name">{adminEmail}</span><FontAwesomeIcon icon={faArrowRightFromBracket} /></button><button className="mobile-menu-button" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} /></button></div>
    </header>

    <main className="content-wrap">
      <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><span>{selectedTitle}</span><span className="environment-tag">{ENV_LABEL}</span></div>
      {error && <div className="notice error-notice" role="alert">{error}<button aria-label="Dismiss message" onClick={() => setError('')}><FontAwesomeIcon icon={faXmark} /></button></div>}
      {view === 'overview' && <OverviewView data={overview} busy={busy} onOpenUser={openUser} onViewUsers={() => { setPage(1); setView('users'); }} />}
      {view === 'users' && <UsersView data={users} busy={busy} error={error} search={search} setSearch={setSearch} status={status} setStatus={(value) => { setStatus(value); setPage(1); }} provider={provider} setProvider={(value) => { setProvider(value); setPage(1); }} page={page} setPage={setPage} pageSize={pageSize} setPageSize={(value) => { setPageSize(value); setPage(1); }} onOpenUser={openUser} />}
      {view === 'audit' && <AuditView data={audit} busy={busy} error={error} action={auditAction} setAction={(value) => { setAuditAction(value); setPage(1); }} search={auditSearch} setSearch={setAuditSearch} page={page} setPage={setPage} onOpenUser={openUser} />}
      <footer className="page-footer"><span>STRATVEDA <b>·</b> OPERATIONS CONSOLE</span><span>Administrative actions are recorded in the audit ledger.</span></footer>
    </main>

    {(detailBusy || selectedUser) && <AccountDrawer detail={selectedUser} loading={detailBusy} onClose={closeUserDrawer} onToggle={toggleAccount} />}
  </div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1><p className="section-description">{description}</p></div>{action}</div>;
}

function OverviewView({ data, busy, onOpenUser, onViewUsers }: { data: Overview | null; busy: boolean; onOpenUser: (id: string) => void; onViewUsers: () => void }) {
  const metrics = data?.metrics;
  const activeRate = metrics?.totalUsers ? Math.round((metrics.activeUsers / metrics.totalUsers) * 100) : 0;
  return <>
    <SectionHeading eyebrow="OPERATIONS BRIEFING · TODAY" title="Your user base, in focus." description="A clear view of account growth, access, and recent sign-in activity." action={<span className="update-label"><FontAwesomeIcon icon={faClock} /> Updated just now</span>} />
    <section className="metric-ribbon" aria-label="User account metrics">
      <Metric label="Total accounts" value={metrics ? formatNumber(metrics.totalUsers) : '—'} detail="Across all sign-in methods" icon={faUsers} tone="blue" />
      <Metric label="Access enabled" value={metrics ? formatNumber(metrics.activeUsers) : '—'} detail={metrics ? `${activeRate}% of all accounts` : 'Current account state'} icon={faUserCheck} tone="green" />
      <Metric label="Joined today" value={metrics ? formatNumber(metrics.newToday) : '—'} detail="New accounts since midnight" icon={faUserPlus} tone="orange" />
      <Metric label="Joined in 30 days" value={metrics ? formatNumber(metrics.signupsLast30Days) : '—'} detail="Rolling signup period" icon={faArrowDown} tone="violet" />
    </section>

    <section className="brief-grid">
      <article className="brief-card growth-card"><div className="card-heading"><div><p className="kicker">ACCOUNT GROWTH</p><h2>Signups over time</h2></div><span className="period-chip">Last 30 days</span></div><SignupChart values={data?.signupsByDay ?? []} busy={busy && !data} /></article>
      <article className="brief-card provider-card"><div className="card-heading"><div><p className="kicker">IDENTITY MIX</p><h2>Sign-in methods</h2></div><FontAwesomeIcon className="card-corner-icon" icon={faFingerprint} /></div><ProviderBreakdown values={data?.providers ?? []} busy={busy && !data} /></article>
      <article className="brief-card recent-accounts"><div className="card-heading"><div><p className="kicker">NEW TO THE WORKSPACE</p><h2>Recently joined</h2></div><button className="text-action" onClick={onViewUsers}>View directory <FontAwesomeIcon icon={faArrowRight} /></button></div><div className="recent-list">{data?.recentUsers.map((user) => <button className="recent-row" key={user._id} onClick={() => onOpenUser(user._id)}><PersonIdentity user={user} /><span className="recent-date">{dateLabel(user.createdAt, { month: 'short', day: 'numeric' })}<FontAwesomeIcon icon={faArrowUpRightFromSquare} /></span></button>)}{!data?.recentUsers.length && <EmptyState loading={busy} title="No new accounts yet" detail="New signups will appear here." />}</div></article>
      <article className="brief-card activity-card"><div className="card-heading"><div><p className="kicker">LIVE SIGNALS</p><h2>Recent sign-ins</h2></div><span className="signal-mark"><i /> User activity</span></div><div className="activity-list">{data?.recentActivity.map((activity, index) => <div className="activity-row" key={activity._id || `${activity.createdAt}-${index}`}><span className="activity-icon"><FontAwesomeIcon icon={faFingerprint} /></span><div className="activity-description"><strong>{activity.user?.name || activity.user?.email || 'Unidentified account'}</strong><span>{titleCase(activity.activity)} · {titleCase(activity.provider)}</span></div><time>{relativeTime(activity.createdAt)}</time></div>)}{!data?.recentActivity.length && <EmptyState loading={busy} title="No sign-ins to show" detail="Recorded sign-in events will appear here." />}</div></article>
    </section>
  </>;
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: typeof faUsers; tone: string }) {
  return <article className="metric-item"><div className="metric-top"><span className={`metric-icon ${tone}`}><FontAwesomeIcon icon={icon} /></span><span className="metric-period">CURRENT</span></div><p className="metric-value">{value}</p><p className="metric-label">{label}</p><p className="metric-detail">{detail}</p></article>;
}

function SignupChart({ values, busy }: { values: Overview['signupsByDay']; busy: boolean }) {
  const max = Math.max(1, ...values.map((item) => item.count));
  const total = values.reduce((sum, item) => sum + item.count, 0);
  if (busy) return <div className="chart-skeleton" aria-label="Loading signup trend" />;
  if (!values.length) return <EmptyState title="Signup trend unavailable" detail="There is no daily signup data for this period." />;
  const barWidth = 12;
  const gap = 5;
  const chartWidth = values.length * (barWidth + gap) - gap;
  return <div className="chart-wrap"><div className="chart-total"><strong>{formatNumber(total)}</strong><span>accounts joined during this period</span></div><svg className="signup-chart" viewBox={`0 0 ${chartWidth} 112`} role="img" aria-label={`Daily signups over 30 days, ${total} total accounts`} preserveAspectRatio="none"><line x1="0" x2={chartWidth} y1="24" y2="24" /><line x1="0" x2={chartWidth} y1="57" y2="57" /><line x1="0" x2={chartWidth} y1="90" y2="90" />{values.map((item, index) => { const height = Math.max(3, (item.count / max) * 82); return <rect key={item.date} x={index * (barWidth + gap)} y={94 - height} width={barWidth} height={height} rx="3" className={index === values.length - 1 ? 'bar current' : 'bar'}><title>{`${dateLabel(item.date, { month: 'short', day: 'numeric' })}: ${item.count} signups`}</title></rect>; })}</svg><div className="chart-axis"><span>{dateLabel(values[0]?.date, { month: 'short', day: 'numeric' })}</span><span>{dateLabel(values[14]?.date, { month: 'short', day: 'numeric' })}</span><span>{dateLabel(values.at(-1)?.date, { month: 'short', day: 'numeric' })}</span></div></div>;
}

function ProviderBreakdown({ values, busy }: { values: Overview['providers']; busy: boolean }) {
  if (busy) return <div className="provider-skeleton" aria-label="Loading sign-in method data" />;
  const total = values.reduce((sum, item) => sum + item.count, 0);
  const palette = ['#3157d5', '#eb7045', '#7b68bf', '#43a58d', '#d9a830'];
  const circumference = 2 * Math.PI * 43;
  let offset = 0;
  return <div className="provider-breakdown">{values.length > 0 && <div className="provider-chart"><svg viewBox="0 0 110 110" role="img" aria-label={`Sign-in methods for ${formatNumber(total)} accounts`}><circle className="donut-track" cx="55" cy="55" r="43" />{values.map((item, index) => { const portion = total ? item.count / total : 0; const segment = <circle key={item.provider || 'unknown'} cx="55" cy="55" r="43" className="donut-segment" stroke={palette[index % palette.length]} strokeDasharray={`${portion * circumference} ${circumference}`} strokeDashoffset={-offset} />; offset += portion * circumference; return segment; })}</svg><div className="provider-center"><strong>{formatNumber(total)}</strong><span>accounts</span></div></div>}<div className="provider-list">{values.map((item, index) => { const pct = total ? Math.round(item.count / total * 100) : 0; return <div className="provider-item" key={item.provider || 'unknown'}><div className="provider-label"><i style={{ backgroundColor: palette[index % palette.length] }} /><span>{titleCase(item.provider || 'Unknown')}</span><strong>{formatNumber(item.count)} · {pct}%</strong></div><div className="provider-track"><span style={{ width: `${pct}%`, backgroundColor: palette[index % palette.length] }} /></div></div>; })}{!values.length && <EmptyState title="No method data" detail="Sign-in methods will appear here." />}</div></div>;
}

function UsersView({ data, busy, error, search, setSearch, status, setStatus, provider, setProvider, page, setPage, pageSize, setPageSize, onOpenUser }: {
  data: PageResult<UserRow> | null; busy: boolean; error: string; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void;
  provider: string; setProvider: (value: string) => void; page: number; setPage: (value: number) => void; pageSize: number; setPageSize: (value: number) => void; onOpenUser: (id: string) => void;
}) {
  const items = data?.items ?? [];
  return <>
    <SectionHeading eyebrow="ACCOUNT DIRECTORY" title="People and access." description="Find a user, understand their sign-in context, and make an informed access decision." action={<span className="directory-total"><strong>{data ? formatNumber(data.pagination.total) : '—'}</strong> accounts</span>} />
    <section className="directory-shell" aria-label="Account directory">
      <div className="directory-tools"><label className="directory-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input aria-label="Search accounts" placeholder="Search by name or email" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="filter-tools"><span className="filter-label"><FontAwesomeIcon icon={faSliders} /> Refine</span><select aria-label="Filter account status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All access states</option><option value="active">Access enabled</option><option value="inactive">Access disabled</option></select><select aria-label="Filter sign-in provider" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="all">All sign-in methods</option><option value="google">Google</option><option value="microsoft">Microsoft</option><option value="linkedin">LinkedIn</option><option value="password">Password</option></select><button className="filter-reset" onClick={() => { setSearch(''); setStatus('all'); setProvider('all'); }} aria-label="Clear account filters"><FontAwesomeIcon icon={faFilter} /> Clear</button></div></div>
      {error && !data && <div className="directory-message" role="status">The account list could not be loaded. Try refreshing the page.</div>}
      <div className="table-container"><table className="account-table"><thead><tr><th scope="col">ACCOUNT</th><th scope="col">SIGN-IN</th><th scope="col">VERIFICATION</th><th scope="col">ACCESS</th><th scope="col">JOINED</th><th scope="col"><span className="sr-only">Open account</span></th></tr></thead><tbody>{busy && !data ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="loading-row"><td colSpan={6}><span /><span /></td></tr>) : items.map((user) => <tr key={user._id} className="account-row"><td><PersonIdentity user={user} /></td><td><ProviderTag provider={user.provider} /></td><td><span className={`verification ${user.emailVerified ? 'verified' : 'pending'}`}><i />{user.emailVerified ? 'Verified' : 'Unverified'}</span></td><td><AccessTag active={user.isActive !== false} /></td><td className="joined-date">{dateLabel(user.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><button className="row-open" aria-label={`Open ${user.name || user.email || 'account'} details`} onClick={() => onOpenUser(user._id)}><FontAwesomeIcon icon={faArrowRight} /></button></td></tr>)}</tbody></table></div>
      <div className="mobile-account-list">{busy && !data ? Array.from({ length: 4 }, (_, index) => <div className="mobile-account-card mobile-loading" key={index}><span /><span /></div>) : items.map((user) => <button className="mobile-account-card" key={user._id} onClick={() => onOpenUser(user._id)}><PersonIdentity user={user} /><span className="mobile-account-meta"><span className="mobile-account-tags"><ProviderTag provider={user.provider} /><span className={`verification ${user.emailVerified ? 'verified' : 'pending'}`}><i />{user.emailVerified ? 'Verified' : 'Unverified'}</span><AccessTag active={user.isActive !== false} /></span><span className="mobile-account-date">Joined {dateLabel(user.createdAt, { month: 'short', day: 'numeric' })}</span></span></button>)}</div>
      {!busy && items.length === 0 && <EmptyState title="No accounts found" detail={search || status !== 'all' || provider !== 'all' ? 'Try changing your search or filters.' : 'New accounts will appear here.'} />}
      <div className="directory-footer"><label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><span className="range-label">{data?.pagination.total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.pagination.total)} of ${formatNumber(data.pagination.total)}` : '0 accounts'}</span><div className="pager"><button aria-label="Previous page" disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}><FontAwesomeIcon icon={faChevronLeft} /></button><span>{data?.pagination.pages ? `${page} / ${data.pagination.pages}` : '0 / 0'}</span><button aria-label="Next page" disabled={page >= (data?.pagination.pages ?? 0) || busy} onClick={() => setPage(page + 1)}><FontAwesomeIcon icon={faChevronRight} /></button></div></div>
    </section>
  </>;
}

function AuditView({ data, busy, error, action, setAction, search, setSearch, page, setPage, onOpenUser }: {
  data: AuditResult | null; busy: boolean; error: string; action: string; setAction: (value: string) => void; search: string; setSearch: (value: string) => void; page: number; setPage: (value: number) => void; onOpenUser: (id: string) => void;
}) {
  const items = data?.items ?? [];
  return <>
    <SectionHeading eyebrow="ACCOUNTABILITY" title="A record of access." description="Review account changes made by administrators, with the affected account and event time." action={<span className="audit-status"><FontAwesomeIcon icon={faShieldHalved} /> Append-only activity</span>} />
    <section className="ledger-shell" aria-label="Admin activity ledger"><div className="ledger-tools"><label className="ledger-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input aria-label="Search activity" placeholder="Search administrator or account" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter by event" value={action} onChange={(event) => setAction(event.target.value)}><option value="all">All events</option><option value="user.activated">Access restored</option><option value="user.deactivated">Access disabled</option></select><span className="ledger-count">{data ? `${formatNumber(data.pagination.total)} recorded events` : 'Recorded events'}</span></div>
      <div className="ledger-head"><span>EVENT</span><span>ACTOR</span><span>AFFECTED ACCOUNT</span><span>WHEN</span><span>ORIGIN</span></div>
      <div className="ledger-list">{busy && !data ? <div className="ledger-loading">Loading the activity ledger…</div> : items.map((item, index) => <div className="ledger-row" key={`${item.createdAt}-${item.targetUserId}-${index}`}><div className="ledger-event"><span className={`event-glyph ${item.action.endsWith('deactivated') ? 'disabled' : ''}`}><FontAwesomeIcon icon={item.action.endsWith('deactivated') ? faArrowDown : faCheck} /></span><span>{item.action.endsWith('deactivated') ? 'Access disabled' : 'Access restored'}</span></div><span className="ledger-actor">{item.actor}</span>{item.targetExists ? <button className="ledger-person" onClick={() => onOpenUser(item.targetUserId)}><strong>{item.targetName || 'Unnamed account'}</strong><span>{item.targetEmail || item.targetUserId}</span></button> : <div className="ledger-person deleted"><strong>Deleted account</strong><span>{item.targetUserId}</span></div>}<time className="ledger-time" dateTime={item.createdAt}>{dateLabel(item.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}<span>{dateLabel(item.createdAt, { hour: 'numeric', minute: '2-digit' })}</span></time><span className="ledger-origin">{item.ipAddress || 'Not recorded'}</span></div>)}{!busy && !items.length && <EmptyState title={error ? 'Activity could not be loaded' : 'Nothing recorded yet'} detail={error ? 'Try refreshing the page.' : 'Account access changes will appear here.'} />}</div>
      <div className="directory-footer"><span className="range-label">{data?.pagination.total ? `Page ${page} of ${data.pagination.pages}` : 'No events'}</span><div className="pager"><button aria-label="Previous page" disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}><FontAwesomeIcon icon={faChevronLeft} /></button><span>{data?.pagination.pages ? `${page} / ${data.pagination.pages}` : '0 / 0'}</span><button aria-label="Next page" disabled={page >= (data?.pagination.pages ?? 0) || busy} onClick={() => setPage(page + 1)}><FontAwesomeIcon icon={faChevronRight} /></button></div></div>
    </section>
  </>;
}

function AccountDrawer({ detail, loading, onClose, onToggle }: { detail: UserDetail | null; loading: boolean; onClose: () => void; onToggle: (user: UserRow) => void }) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,select,[tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); opener?.focus(); };
  }, [onClose]);
  const user = detail?.user;
  return <div className="drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="account-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="account-drawer-title"><div className="drawer-top"><span className="kicker">ACCOUNT RECORD</span><button ref={closeRef} className="drawer-close" onClick={onClose} aria-label="Close account details"><FontAwesomeIcon icon={faXmark} /></button></div>{loading || !user ? <div className="drawer-loading"><span /><span /><span /></div> : <><div className="drawer-identity"><span className="large-avatar">{shortName(user.name, user.email)}</span><div><h2 id="account-drawer-title">{user.name || 'Unnamed account'}</h2><p>{user.email || 'No email address on file'}</p></div></div><div className="drawer-tags"><AccessTag active={user.isActive !== false} /><ProviderTag provider={user.provider} /></div><div className="detail-facts"><div><span>EMAIL VERIFICATION</span><strong>{user.emailVerified ? 'Verified' : 'Not verified'}</strong></div><div><span>CREATED</span><strong>{dateLabel(user.createdAt)}</strong></div><div><span>LAST PROFILE UPDATE</span><strong>{dateLabel(user.updatedAt)}</strong></div><div><span>LOCALE</span><strong>{user.locale || 'Not provided'}</strong></div></div><section className="drawer-activity"><div className="drawer-section-heading"><div><p className="kicker">ACCOUNT HISTORY</p><h3>Recent sign-ins</h3></div><span>{detail.activities.length} events</span></div>{detail.activities.length ? detail.activities.slice(0, 15).map((activity, index) => <div className="drawer-event" key={activity._id || `${activity.createdAt}-${index}`}><span className="drawer-event-dot" /><div><strong>{titleCase(activity.activity)}</strong><p>{titleCase(activity.provider)}{activity.devicePlatform ? ` · ${activity.devicePlatform}` : ''}{activity.browser ? ` · ${activity.browser}` : ''}</p></div><time>{relativeTime(activity.createdAt)}</time></div>) : <p className="quiet-empty">No sign-in events are recorded for this account.</p>}</section><div className="drawer-actions"><div><p className="kicker">ACCESS CONTROL</p><p>{user.isActive === false ? 'This account is currently unable to sign in.' : 'This account can currently access the product.'}</p></div><button className={`button ${user.isActive === false ? 'primary' : 'danger'}`} onClick={() => onToggle(user)}><FontAwesomeIcon icon={user.isActive === false ? faCircleCheck : faArrowDown} />{user.isActive === false ? 'Restore access' : 'Disable access'}</button></div></>}</aside></div>;
}

function PersonIdentity({ user }: { user: UserRow }) {
  return <span className="person-identity"><span className="person-avatar">{shortName(user.name, user.email)}</span><span className="person-copy"><strong>{user.name || 'Unnamed account'}</strong><span>{user.email || 'No email on file'}</span></span></span>;
}

function ProviderTag({ provider }: { provider?: string }) {
  return <span className="provider-tag"><FontAwesomeIcon icon={provider === 'password' ? faFingerprint : faGlobe} />{titleCase(provider)}</span>;
}

function AccessTag({ active }: { active: boolean }) {
  return <span className={`access-tag ${active ? 'enabled' : 'disabled'}`}><i />{active ? 'Enabled' : 'Disabled'}</span>;
}

function EmptyState({ title, detail, loading = false }: { title: string; detail: string; loading?: boolean }) {
  return <div className={`empty-state ${loading ? 'loading' : ''}`} role="status"><span className="empty-mark"><FontAwesomeIcon icon={loading ? faEllipsis : faUsers} /></span><strong>{loading ? 'Loading records…' : title}</strong><p>{loading ? 'Please wait while the latest data arrives.' : detail}</p></div>;
}
