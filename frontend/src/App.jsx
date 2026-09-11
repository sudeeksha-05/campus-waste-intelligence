import React, { useEffect, useState } from 'react'
import {
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Eye,
  EyeOff,
  Filter,
  Download,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  LineChart,
  Map,
  LogOut,
  Menu,
  Radar,
  Search,
  Settings,
  Trash2,
  User,
  UserPlus,
  AlertTriangle,
  Building2,
  MapPin,
} from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts'
import './App.css'
import { accountExists, authenticate, protectedPages, pageFromPath, registerUser, routeForPage } from './auth'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
  { label: 'Bin Monitoring', icon: Trash2, page: 'bins' },
  { label: 'Collection Priority', icon: AlertTriangle, page: 'priority' },
  { label: 'Analytics', icon: BarChart3, page: 'analytics' },
  { label: 'Collection Routes', icon: Map, page: 'routes' },
  { label: 'AI Waste Assistant', icon: Bot, page: 'assistant' },
  { label: 'Reports', icon: ClipboardCheck, page: 'reports' },
  { label: 'Settings', icon: Settings, page: 'settings' },
]

const API = 'http://127.0.0.1:8000/api'
const ACTIVE_CAMPUS = 'Spoorthy Engineering College'
const CAMPUS_OPTIONS = [ACTIVE_CAMPUS, 'Other Colleges', 'Residential Communities', 'Municipal Areas', 'Smart City Zones']
const LOCATION_OPTIONS = ['All Locations', 'Academic Block A', 'Academic Block B', 'Canteen', 'Hostel Block A', 'Hostel Block B', 'Library', 'Sports Complex']
const RISK_OPTIONS = ['All Risk Levels', 'High Risk', 'Medium Risk', 'Low Risk']
const WASTE_OPTIONS = ['All Waste Types', 'Paper', 'Plastic', 'Food / Organic', 'Mixed Waste', 'E-Waste']
const FUTURE_CAMPUSES = new Set(CAMPUS_OPTIONS.slice(1))

function App() {
  const cachedAuth = () => {
    const remember = localStorage.getItem('campus_waste_remember_me') === 'true'
    const session = sessionStorage.getItem('campus_waste_auth_session')
    const saved = localStorage.getItem('campus_waste_auth_session')
    if (remember && saved) return JSON.parse(saved)
    if (session) return JSON.parse(session)
    return null
  }

  const [auth, setAuth] = useState(cachedAuth())
  const [page, setPage] = useState(pageFromPath(window.location.pathname))
  const [dashboard, setDashboard] = useState(null)
  const [bins, setBins] = useState([])
  const [priority, setPriority] = useState([])
  const [locationData, setLocationData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [riskData, setRiskData] = useState([])
  const [routes, setRoutes] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState('All')
  const [selectedCampus, setSelectedCampus] = useState(ACTIVE_CAMPUS)
  const [selectedRisk, setSelectedRisk] = useState('All Risk Levels')
  const [selectedWasteType, setSelectedWasteType] = useState('All Waste Types')
  const [binSearch, setBinSearch] = useState('')
  const [collectionStatuses, setCollectionStatuses] = useState(() => JSON.parse(localStorage.getItem('campus_waste_collection_statuses') || '{}'))
  const [selectedPriorityBin, setSelectedPriorityBin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth) {
      const publicPage = pageFromPath(window.location.pathname)
      if (protectedPages().includes(publicPage)) {
        window.history.pushState({}, '', '/login')
        setPage('login')
      } else {
        setPage(publicPage)
      }
      return
    }

    if (['/', '/login', '/register', '/forgot-password'].includes(window.location.pathname)) {
      window.history.pushState({}, '', '/dashboard')
    }

    const requested = pageFromPath(window.location.pathname)
    if (protectedPages().includes(requested)) {
      setPage(requested)
    } else {
      setPage('dashboard')
      window.history.pushState({}, '', '/dashboard')
    }
  }, [auth])

  useEffect(() => {
    const handlePopState = () => {
      const requested = pageFromPath(window.location.pathname)
      if (!auth && protectedPages().includes(requested)) {
        window.history.replaceState({}, '', '/login')
        setPage('login')
        return
      }
      if (auth && !protectedPages().includes(requested)) {
        window.history.replaceState({}, '', '/dashboard')
        setPage('dashboard')
        return
      }
      setPage(requested)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [auth])

  useEffect(() => {
    if (!auth || FUTURE_CAMPUSES.has(selectedCampus)) return

    setLoading(true)
    const locationQuery = selectedLocation !== 'All' ? `?location=${encodeURIComponent(selectedLocation)}` : ''
    Promise.all([
      fetch(`${API}/dashboard${locationQuery}`).then((r) => r.json()),
      fetch(`${API}/bins`).then((r) => r.json()),
      fetch(`${API}/priority`).then((r) => r.json()),
      fetch(`${API}/analytics/location`).then((r) => r.json()),
      fetch(`${API}/analytics/trend?days=7`).then((r) => r.json()),
      fetch(`${API}/analytics/risk${locationQuery}`).then((r) => r.json()),
      fetch(`${API}/routes`).then((r) => r.json()),
    ])
      .then(([dash, binRows, prRows, locRows, trendRows, riskRows, routeRows]) => {
        setDashboard(dash)
        setBins(binRows)
        setPriority(prRows)
        setLocationData(locRows)
        setTrendData(trendRows)
        setRiskData(Object.entries(riskRows).map(([name, value]) => ({ name, value })))
        setRoutes(routeRows)
        setLoading(false)
      })
      .catch((e) => {
        setError('Unable to retrieve latest bin data.')
        setLoading(false)
      })
  }, [auth, selectedLocation, selectedCampus])

  const visibleBins = bins.filter((row) => {
    const locationMatches = selectedLocation === 'All' || row.location === selectedLocation || (selectedLocation === 'Hostel Block A' && row.location === 'Hostel Block 1') || (selectedLocation === 'Hostel Block B' && row.location === 'Hostel Block 2')
    const riskMatches = selectedRisk === 'All Risk Levels' || row.predicted_risk === selectedRisk
    const wasteMatches = selectedWasteType === 'All Waste Types' || row.waste_type === selectedWasteType || (selectedWasteType === 'Food / Organic' && row.waste_type === 'Organic') || (selectedWasteType === 'Mixed Waste' && row.waste_type === 'Mixed')
    const searchMatches = !binSearch.trim() || row.bin_id.toLowerCase().includes(binSearch.trim().toLowerCase())
    return locationMatches && riskMatches && wasteMatches && searchMatches
  })
  const visiblePriority = priority.filter((row) => {
    const locationMatches = selectedLocation === 'All' || row.location === selectedLocation || (selectedLocation === 'Hostel Block A' && row.location === 'Hostel Block 1') || (selectedLocation === 'Hostel Block B' && row.location === 'Hostel Block 2')
    const riskMatches = selectedRisk === 'All Risk Levels' || row.predicted_risk === selectedRisk
    const wasteMatches = selectedWasteType === 'All Waste Types' || row.waste_type === selectedWasteType || (selectedWasteType === 'Food / Organic' && row.waste_type === 'Organic') || (selectedWasteType === 'Mixed Waste' && row.waste_type === 'Mixed')
    return locationMatches && riskMatches && wasteMatches && collectionStatuses[row.bin_id] !== 'Collected'
  })

  const updateCollectionStatus = (binId, status) => {
    const next = { ...collectionStatuses, [binId]: status }
    setCollectionStatuses(next)
    localStorage.setItem('campus_waste_collection_statuses', JSON.stringify(next))
  }

  const assignCollection = (binId) => {
    const team = window.prompt('Assign this bin to a collection worker or team:')
    if (team && team.trim()) updateCollectionStatus(binId, `Assigned to ${team.trim()}`)
  }

  const kpis = dashboard?.kpis || {
    total_bins: 0,
    high_risk: 0,
    medium_risk: 0,
    low_risk: 0,
    average_fill_level: 0,
    collection_required: 0,
  }

  const handleLogin = (email, password, remember) => {
    const result = authenticate(email, password)
    if (!result.ok) {
      return result
    }

    const session = { user: result.user, remember }
    setAuth(session)
    if (remember) {
      localStorage.setItem('campus_waste_remember_me', 'true')
      localStorage.setItem('campus_waste_auth_session', JSON.stringify(session))
    } else {
      localStorage.removeItem('campus_waste_remember_me')
      localStorage.removeItem('campus_waste_auth_session')
      sessionStorage.setItem('campus_waste_auth_session', JSON.stringify(session))
    }
    window.history.pushState({}, '', '/dashboard')
    setPage('dashboard')
    return result
  }

  const handleRegister = (details) => registerUser(details)

  const handleLogout = () => {
    localStorage.removeItem('campus_waste_auth_session')
    localStorage.removeItem('campus_waste_remember_me')
    sessionStorage.removeItem('campus_waste_auth_session')
    setAuth(null)
    setPage('login')
    setDashboard(null)
    setBins([])
    setPriority([])
    setLocationData([])
    setTrendData([])
    setRiskData([])
    setRoutes(null)
    setError('')
    setLoading(false)
    window.history.pushState({}, '', '/')
  }

  if (!auth) {
    if (page === 'landing') return <LandingPage onNavigate={(nextPage) => { setPage(nextPage); window.history.pushState({}, '', routeForPage(nextPage)) }} />
    if (page === 'register') return <RegisterPage onRegister={handleRegister} onNavigate={(nextPage) => { setPage(nextPage); window.history.pushState({}, '', routeForPage(nextPage)) }} />
    if (page === 'forgot-password') return <ForgotPasswordPage onNavigate={(nextPage) => { setPage(nextPage); window.history.pushState({}, '', routeForPage(nextPage)) }} />
    return <LoginPage onLogin={handleLogin} onNavigate={(nextPage) => { setPage(nextPage); window.history.pushState({}, '', routeForPage(nextPage)) }} />
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={(nextPage) => {
        setPage(nextPage)
        if (nextPage === 'login') {
          handleLogout()
          return
        }
        window.history.pushState({}, '', routeForPage(nextPage))
      }} onLogout={handleLogout} user={auth.user} />
      <main className="main-content">
        <Header page={page} user={auth.user} onLogout={handleLogout} selectedCampus={selectedCampus} onCampusChange={setSelectedCampus} />
        <div className="app-content">
          {error && <div className="error-banner">{error}</div>}
          {loading ? <LoadingSkeleton /> : null}
          {FUTURE_CAMPUSES.has(selectedCampus) && <ComingSoonPage onBack={() => setSelectedCampus(ACTIVE_CAMPUS)} />}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'dashboard' && (
            <DashboardPage dashboard={dashboard} bins={visibleBins} locationData={locationData} trendData={trendData} riskData={riskData} kpis={kpis} selectedLocation={selectedLocation} onLocationChange={setSelectedLocation} />
          )}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'bins' && <BinMonitoringPage bins={visibleBins} statuses={collectionStatuses} locationOptions={LOCATION_OPTIONS} riskOptions={RISK_OPTIONS} wasteOptions={WASTE_OPTIONS} selectedLocation={selectedLocation} onLocationChange={setSelectedLocation} selectedRisk={selectedRisk} onRiskChange={setSelectedRisk} selectedWasteType={selectedWasteType} onWasteTypeChange={setSelectedWasteType} search={binSearch} onSearch={setBinSearch} />}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'priority' && <PriorityPage priority={visiblePriority} statuses={collectionStatuses} onAssign={assignCollection} onCollected={(binId) => updateCollectionStatus(binId, 'Collected')} onView={setSelectedPriorityBin} />}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'analytics' && <AnalyticsPage locationData={locationData} trendData={trendData} riskData={riskData} bins={bins} onNavigateToBins={(location) => { setSelectedLocation(location); setPage('bins'); window.history.pushState({}, '', '/bins') }} />}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'routes' && <RoutePage routes={routes} priority={priority} />}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'assistant' && <AssistantPage />}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'reports' && <ReportsPage dashboard={dashboard} />}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'settings' && <SettingsPage />}
          {selectedPriorityBin && <PriorityDetailsModal row={selectedPriorityBin} status={collectionStatuses[selectedPriorityBin.bin_id] || 'Active'} onClose={() => setSelectedPriorityBin(null)} />}
        </div>
      </main>
    </div>
  )
}

function LandingPage({ onNavigate }) {
  return (
    <div className="public-page landing-page">
      <header className="public-nav">
        <button className="public-brand" onClick={() => onNavigate('landing')}><span className="public-brand-icon"><Trash2 size={22} /></span><span>Campus Waste Intelligence</span></button>
        <nav><button onClick={() => onNavigate('login')}>Login</button><button className="nav-register" onClick={() => onNavigate('register')}>Create Account</button></nav>
      </header>
      <main className="landing-main">
        <section className="landing-copy">
          <div className="eyebrow"><span className="status-dot"></span> AI-powered campus operations</div>
          <h1>SMARTER WASTE.<br /><em>CLEANER CAMPUS.</em></h1>
          <p>AI-powered monitoring and collection decision support for sustainable campus waste management.</p>
          <div className="landing-actions"><button className="landing-primary" onClick={() => onNavigate('register')}>Get Started <ArrowRight size={17} /></button><button className="landing-secondary" onClick={() => onNavigate('login')}>Login</button></div>
          <div className="landing-trust"><CheckCircle2 size={16} /> Monitor fill levels <CheckCircle2 size={16} /> Prioritize collections <CheckCircle2 size={16} /> Reduce overflow</div>
        </section>
        <section className="landing-visual" aria-label="Smart waste monitoring preview">
          <div className="visual-orbit orbit-one"></div><div className="visual-orbit orbit-two"></div>
          <div className="visual-bin"><Trash2 size={92} /></div>
          <div className="visual-card visual-card-top"><span className="visual-card-label">AI RISK SCORE</span><strong>18%</strong><span className="risk-safe">Low overflow risk</span></div>
          <div className="visual-card visual-card-bottom"><span className="visual-card-label">SMART CAMPUS DATA</span><strong>Live</strong><span className="online-line"><span className="status-dot"></span> Sensor intelligence</span></div>
        </section>
      </main>
      <section className="landing-features"><div><Bot size={20} /><strong>AI Overflow Prediction</strong><span>Spot risk before it becomes a problem.</span></div><div><Radar size={20} /><strong>Smart Collection Priority</strong><span>Send teams where they matter most.</span></div><div><BarChart3 size={20} /><strong>Waste Analytics</strong><span>Turn campus data into better decisions.</span></div></section>
      <footer className="public-footer">Campus Waste Intelligence <span>SDG 11 • Sustainable Cities and Communities</span></footer>
    </div>
  )
}

function RegisterPage({ onRegister, onNavigate }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'Admin' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Please enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = 'Please enter a valid email address.'
    if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); setMessage(''); return }
    setLoading(true)
    const result = onRegister(form)
    setLoading(false)
    if (!result.ok) { setErrors({ email: result.message }); return }
    setErrors({})
    setMessage('Account created successfully. You can now sign in.')
  }

  return <AuthPageShell title="Create your account" subtitle="Set up access to the campus waste intelligence system" onNavigate={onNavigate}>
    {message && <div className="success-message"><CheckCircle2 size={17} />{message}</div>}
    <form className="login-form" onSubmit={submit} noValidate>
      <div className="form-group"><label htmlFor="register-name">Full Name</label><input id="register-name" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Your full name" className={errors.name ? 'invalid' : ''} />{errors.name && <div className="form-error">{errors.name}</div>}</div>
      <div className="form-group"><label htmlFor="register-email">Email Address</label><input id="register-email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="you@campuswaste.ai" className={errors.email ? 'invalid' : ''} />{errors.email && <div className="form-error">{errors.email}</div>}</div>
      <div className="form-group"><label htmlFor="register-password">Password</label><div className="password-wrap"><input id="register-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="At least 8 characters" className={errors.password ? 'invalid' : ''} /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <div className="form-error">{errors.password}</div>}</div>
      <div className="form-group"><label htmlFor="register-confirm">Confirm Password</label><input id="register-confirm" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} placeholder="Repeat your password" className={errors.confirmPassword ? 'invalid' : ''} />{errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}</div>
      <div className="form-group"><label htmlFor="register-role">Role</label><select id="register-role" value={form.role} onChange={(event) => update('role', event.target.value)}><option>Admin</option><option>Waste Management Staff</option><option>Campus Manager</option></select></div>
      <button className="login-button" type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
    </form>
    <div className="auth-switch">Already have an account? <button onClick={() => onNavigate('login')}>Login</button></div>
  </AuthPageShell>
}

function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = (event) => { event.preventDefault(); if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Please enter a valid email address.'); setMessage(''); return } if (!accountExists(email)) { setError('No account was found with that email.'); setMessage(''); return } setError(''); setMessage('This prototype has verified your account. Password recovery would be sent through a production auth service.') }
  return <AuthPageShell title="Reset your password" subtitle="Check whether your account is registered" onNavigate={onNavigate}>
    {message && <div className="success-message"><CheckCircle2 size={17} />{message}</div>}
    <form className="login-form" onSubmit={submit} noValidate><div className="form-group"><label htmlFor="forgot-email">Email Address</label><input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@campuswaste.ai" className={error ? 'invalid' : ''} />{error && <div className="form-error">{error}</div>}</div><button className="login-button" type="submit">Check Account</button></form>
    <div className="auth-switch"><button onClick={() => onNavigate('login')}>Back to Login</button></div>
  </AuthPageShell>
}

function AuthPageShell({ title, subtitle, children, onNavigate }) {
  return <div className="auth-page"><div className="auth-side"><button className="public-brand" onClick={() => onNavigate('landing')}><span className="public-brand-icon"><Trash2 size={22} /></span><span>Campus Waste Intelligence</span></button><div className="auth-side-copy"><div className="eyebrow"><span className="status-dot"></span> Sustainable campus operations</div><h1>Smarter Waste.<br /><em>Cleaner Campus.</em></h1><p>AI-powered collection intelligence for healthier, more sustainable campuses.</p></div></div><div className="auth-content"><div className="login-card"><div className="login-card-head"><div className="login-brand-logo"><Trash2 size={24} /></div><div><div className="login-app-title">Campus Waste Intelligence</div><div className="login-app-subtitle">AI-powered monitoring and collection decision support</div></div></div><div className="login-card-title">{title}</div><div className="login-card-subtitle">{subtitle}</div>{children}</div></div></div>
}

function LoginPage({ onLogin, onNavigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    const normalizedEmail = email.trim().toLowerCase()

    if (!email.trim()) nextErrors.email = 'Please enter your email.'
    else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextErrors.email = 'Please enter a valid email address.'

    if (!password.trim()) nextErrors.password = 'Please enter your password.'

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setServerError('')
      return
    }

    setLoading(true)
    setErrors({})
    setServerError('')

    const result = onLogin(email.trim(), password, remember)
    if (!result.ok) {
      setLoading(false)
      setServerError(result.message)
      return
    }

    setLoading(false)
    window.history.pushState({}, '', '/dashboard')
  }

  return (
    <div className="login-screen">
      <div className="login-left">
        <div className="login-brand-panel">
          <div className="login-brand-head">
            <div className="brand-icon login-icon"><Trash2 size={38} /></div>
            <div className="login-brand-copy">
              <div className="login-brand-kicker">CAMPUS WASTE INTELLIGENCE</div>
              <div className="login-brand-title">CAMPUS<br />WASTE<br />INTELLIGENCE</div>
            </div>
          </div>
          <div className="login-brand-message">
            <div className="login-slogan">Smarter Waste. Cleaner Campus.</div>
            <div className="login-slogan-copy">AI-powered collection intelligence helps monitor fill levels, detect overflow risk, and prioritize sustainable campus waste operations.</div>
          </div>
        </div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-head">
            <div className="login-brand-logo"><Trash2 size={34} /></div>
            <div>
              <div className="login-app-title">Campus Waste Intelligence</div>
              <div className="login-app-subtitle">AI-powered monitoring and collection decision support</div>
            </div>
          </div>

          <div className="login-card-title">Welcome back</div>
          <div className="login-card-subtitle">Sign in to continue to the waste intelligence system</div>

          <form className="login-form" onSubmit={submit} noValidate>
            {serverError && <div className="form-error global-error">{serverError}</div>}

            <div className="form-group">
              <label htmlFor="email">Email / Username</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@campuswaste.ai" autoComplete="username" className={errors.email ? 'invalid' : ''} />
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" className={errors.password ? 'invalid' : ''} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>

            <div className="login-options">
              <label className="remember-row"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
              <button type="button" className="forgot-link" onClick={() => onNavigate('forgot-password')}>Forgot password?</button>
            </div>

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? <span className="button-loader"></span> : null}
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
          <div className="auth-switch">New to the system? <button onClick={() => onNavigate('register')}><UserPlus size={14} /> Create account</button></div>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ page, setPage, onLogout, user }) {
  return (
    <aside className="sidebar">
      <div className="brand-wrap">
        <div className="brand-icon"><Trash2 size={32} /></div>
        <div>
          <div className="brand-title">CAMPUS</div>
          <div className="brand-title">WASTE</div>
          <div className="brand-title">INTELLIGENCE</div>
        </div>
      </div>

      <nav className="nav-list">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <button className={`nav-item ${page === item.page ? 'active' : ''}`} key={item.label} onClick={() => setPage(item.page)}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="system-status">
        <div className="system-row">
          <span className="dot"></span>
          <span>System Status</span>
        </div>
        <div className="online-text">● AI System Online</div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar"><User size={26} /></div>
        <div>
          <div className="profile-name">{user?.name || 'Campus Admin'}</div>
          <div className="profile-role">{user?.role || 'Waste Operations'}</div>
        </div>
      </div>

      <button className="logout-button" onClick={onLogout}><LogOut size={16} /> Logout</button>
    </aside>
  )
}

function Header({ page, user, onLogout, selectedCampus, onCampusChange }) {
  return (
    <header className="topbar">
      <div className="left-top">
        <button className="icon-button mobile-menu"><Menu size={20} /></button>
        <div>
          <div className="page-kicker">{page === 'dashboard' ? 'Good Morning' : 'Campus Waste Intelligence'}</div>
          <h1>{pageTitleMap(page)}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <label className="campus-selector"><Building2 size={16} /><span>Campus</span><select value={selectedCampus} onChange={(event) => onCampusChange(event.target.value)}>{CAMPUS_OPTIONS.map((campus) => <option key={campus} value={campus}>{campus}{campus !== ACTIVE_CAMPUS ? ' (Future)' : ''}</option>)}</select></label>
        <div className="search-wrap"><Search size={15} /><input placeholder="Search" /></div>
        <button className="icon-button"><Bell size={18} /></button>
        <div className="user-menu">
          <button className="user-chip"><User size={16} /> {user?.name || 'Admin'}</button>
          <button className="logout-chip" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </header>
  )
}

function ComingSoonPage({ onBack }) {
  return <section className="coming-soon page-section"><div className="coming-soon-icon"><Building2 size={34} /></div><span className="section-label">Future deployment option</span><h2>Coming Soon</h2><p>This prototype is currently configured for Spoorthy Engineering College. The system architecture is designed to support additional campuses and locations in future deployments.</p><button className="primary-button" onClick={onBack}><MapPin size={16} /> Back to Spoorthy Engineering College</button></section>
}

function pageTitleMap(page) {
  return {
    dashboard: 'Campus Waste Intelligence',
    bins: 'Bin Monitoring',
    priority: 'Collection Priority Engine',
    analytics: 'Analytics',
    routes: 'Smart Collection Routes',
    assistant: 'AI Waste Assistant',
    reports: 'Reports',
    settings: 'Settings',
  }[page] || 'Campus Waste Intelligence'
}

function DashboardPage({ dashboard, bins, locationData, trendData, riskData, kpis, selectedLocation, onLocationChange }) {
  const urgent = bins.slice(0, 4)
  const locations = LOCATION_OPTIONS.slice(1)
  const latestTimestamp = dashboard?.monitoring?.latest_timestamp
  return (
    <div className="dashboard-page">
      <section className="intro-row">
        <div>
          <div className="heading-large">Good Morning</div>
          <div className="heading-title">Campus Waste Intelligence</div>
          <div className="heading-subtitle">AI-powered monitoring and collection decision support • Prototype campus: {ACTIVE_CAMPUS}</div>
        </div>
        <button className="primary-button"><CalendarDays size={16} /> Today</button>
      </section>

      <section className="kpi-grid">
        <KpiCard icon={<Trash2 size={22} />} label="Total Bins" value={kpis.total_bins} trend="+2.8%" />
        <KpiCard icon={<AlertTriangle size={22} />} label="High Risk" value={kpis.high_risk} trend="Urgent" riskColor />
        <KpiCard icon={<ActivityIcon />} label="Medium Risk" value={kpis.medium_risk} trend="Monitoring" />
        <KpiCard icon={<BarChart3 size={22} />} label="Low Risk" value={kpis.low_risk} trend="Stable" />
        <KpiCard icon={<LineChart size={22} />} label="Average Fill Level" value={`${kpis.average_fill_level.toFixed(1)}%`} trend="+4.2%" />
        <KpiCard icon={<ClipboardCheck size={22} />} label="Collection Required" value={kpis.collection_required} trend="Active" />
      </section>

      <div className="monitoring-context">
        <div><strong>Showing latest sensor reading for {dashboard?.monitoring?.bin_count ?? kpis.total_bins} bins</strong><span>Simulated Sensor Data • Every physical Bin_ID is counted once in current monitoring.</span></div>
        <div className="monitoring-context-meta"><span>Latest data: {latestTimestamp ? new Date(latestTimestamp).toLocaleString() : 'Unavailable'}</span><label>Location <select value={selectedLocation} onChange={(event) => onLocationChange(event.target.value)}><option value="All">All Campus</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label></div>
      </div>

      <section className="dashboard-grid">
        <section className="panel panel-wide">
          <div className="panel-head">
            <div>
              <span className="section-label">Risk Overview</span>
              <h2>Waste Risk Overview</h2>
            </div>
            <div className="chart-filter"><Filter size={15} /><span>{selectedLocation === 'All' ? 'All Campus' : selectedLocation}</span></div>
          </div>
          <div className="chart-box">
            <RiskPieChart riskData={riskData} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">Fill Level Trend</span>
              <h2>Campus Waste Fill-Level Trend</h2>
            </div>
            <select className="mini-select">
              <option>7 Days</option>
              <option>30 Days</option>
              <option>90 Days</option>
            </select>
          </div>
          <div className="chart-box trend-box">
            <FillTrendChart trendData={trendData} />
          </div>
        </section>
      </section>

      <section className="dashboard-grid two-columns">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">Location Analysis</span>
              <h2>Average Fill Level by Location</h2>
            </div>
          </div>
          <div className="chart-box">
            <LocationBarChart data={locationData} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="section-label">Bins Requiring Immediate Attention</span>
              <h2>Immediate Collection</h2>
            </div>
          </div>
          <div className="urgent-card-grid">
            {urgent.map((row, idx) => (
              <div className="urgent-card" key={row.bin_id}>
                <div className="urgent-card-top">
                  <span className="bin-id">{row.bin_id}</span>
                  <span className={`risk-badge ${row.predicted_risk.toLowerCase().replace(' ', '-')}`}>{row.predicted_risk}</span>
                </div>
                <div className="location-name">{row.location}</div>
                <div className="fill-value">{row.current_fill_level.toFixed(1)}% Full</div>
                <div className="metric-row"><span>Fill Rate:</span><span>{row.fill_rate.toFixed(2)}% / hour</span></div>
                <div className="metric-row"><span>Priority:</span><span>{row.priority}</span></div>
                <div className="metric-row"><span>Estimated overflow:</span><span>{Math.max(row.estimated_overflow_hours, 0.1).toFixed(1)} hours</span></div>
                <div className="card-buttons">
                  <button className="secondary-button">View Details</button>
                  <button className="primary-button small-button">Assign Collection</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}

function RiskPieChart({ riskData }) {
  const data = riskData
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={95} paddingAngle={4}>
          {data.map((entry, idx) => <Cell key={entry.name} fill={['#e05656', '#f7b267', '#75b79e'][idx % 3]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

function FillTrendChart({ trendData }) {
  const data = trendData
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ReLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="average_fill_level" stroke="#0b6b58" strokeWidth={3} />
      </ReLineChart>
    </ResponsiveContainer>
  )
}

function LocationBarChart({ data }) {
  const chartData = data
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 18 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey="location" width={110} />
        <Tooltip />
        <Bar dataKey="average_fill" fill="#0b6b58" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function KpiCard({ icon, label, value, trend, riskColor }) {
  return (
    <section className="kpi-card">
      <div className="kpi-head">
        <span className="kpi-icon">{icon}</span>
        <span className={`trend ${riskColor ? 'danger' : ''}`}>{trend}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </section>
  )
}

function ActivityIcon() {
  return <Radar size={22} />
}

function BinMonitoringPage({ bins, statuses, locationOptions, riskOptions, wasteOptions, selectedLocation, onLocationChange, selectedRisk, onRiskChange, selectedWasteType, onWasteTypeChange, search, onSearch }) {
  return (
    <section className="page-section">
      <div className="section-title-row">
        <div>
          <span className="section-label">Bin Monitoring</span>
          <h2>Bin Monitoring</h2>
          <div className="sub-title">Monitor current waste levels and predicted overflow risk.</div>
        </div>
        <div className="filter-strip">
          <input placeholder="Search Bin ID" value={search} onChange={(event) => onSearch(event.target.value)} />
          <select value={selectedLocation === 'All' ? 'All Locations' : selectedLocation} onChange={(event) => onLocationChange(event.target.value === 'All Locations' ? 'All' : event.target.value)}>{locationOptions.map((option) => <option key={option}>{option}</option>)}</select>
          <select value={selectedRisk} onChange={(event) => onRiskChange(event.target.value)}>{riskOptions.map((option) => <option key={option}>{option}</option>)}</select>
          <select value={selectedWasteType} onChange={(event) => onWasteTypeChange(event.target.value)}>{wasteOptions.map((option) => <option key={option}>{option}</option>)}</select>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bin ID</th>
              <th>Location</th>
              <th>Current Fill</th>
              <th>Fill Rate</th>
              <th>Waste Type</th>
              <th>Predicted Risk</th>
              <th>Priority</th>
              <th>Estimated Overflow</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {bins.slice(0, 100).map((row) => (
              <tr key={row.bin_id}>
                <td className="bin-cell">{row.bin_id}</td>
                <td>{row.location}</td>
                <td>{row.current_fill_level.toFixed(1)}%</td>
                <td>{row.fill_rate.toFixed(2)}%</td>
                <td>{row.waste_type}</td>
                <td><span className={`risk-badge ${row.predicted_risk.toLowerCase().replace(' ', '-')}`}>{row.predicted_risk}</span></td>
                <td>{row.priority}</td>
                <td>{overflowLabel(row.estimated_overflow_hours)}</td>
                <td><span className="status-badge">{statuses[row.bin_id] || 'Active'}</span></td>
                <td><button className="link-button">Details</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function overflowLabel(hours) {
  return hours == null ? 'No immediate overflow predicted' : `${Math.max(hours, 0).toFixed(1)} hours`
}

function PriorityPage({ priority, statuses, onAssign, onCollected, onView }) {
  return (
    <section className="page-section">
      <div className="section-title-row">
        <div>
          <span className="section-label">Collection Priority Engine</span>
          <h2>Collection Priority Engine</h2>
          <div className="sub-title">AI-assisted prioritization of bins requiring collection.</div>
        </div>
      </div>
      <div className="priority-grid">
        {priority.slice(0, 20).map((row, idx) => (
          <div className="priority-card" key={row.bin_id}>
            <div className="priority-rank">#{idx+1}</div>
            <div className="priority-bin">{row.bin_id}</div>
            <div className="priority-location">{row.location}</div>
            <div className="priority-fill">{row.current_fill_level.toFixed(1)}% full</div>
            <div className="priority-meta">Overflow: {overflowLabel(row.estimated_overflow_hours)}</div>
            <div className="priority-meta risk-line">{row.priority} {row.predicted_risk}</div>
            <div className="priority-meta">Status: {statuses[row.bin_id] || 'Active'}</div>
            <div className="priority-meta">{row.priority_explanation}</div>
            <div className="card-buttons">
              <button className="secondary-button small-button" onClick={() => onAssign(row.bin_id)}>Assign</button>
              <button className="secondary-button small-button" onClick={() => onView(row)}>View</button>
              <button className="secondary-button small-button" onClick={() => onCollected(row.bin_id)}>Collected</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PriorityDetailsModal({ row, status, onClose }) {
  return <div className="priority-modal-backdrop" onClick={onClose}><div className="priority-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div><span className="section-label">Bin details</span><h2>{row.bin_id}</h2></div><button className="icon-button" onClick={onClose}>×</button></div><div className="priority-detail-grid"><div><span>Location</span><strong>{row.location}</strong></div><div><span>Waste type</span><strong>{row.waste_type}</strong></div><div><span>Current fill</span><strong>{row.current_fill_level.toFixed(1)}%</strong></div><div><span>Fill rate</span><strong>{row.fill_rate.toFixed(2)}% / hour</strong></div><div><span>Predicted risk</span><strong>{row.predicted_risk}</strong></div><div><span>Estimated overflow</span><strong>{overflowLabel(row.estimated_overflow_hours)}</strong></div><div><span>Priority</span><strong>{row.priority}</strong></div><div><span>Status</span><strong>{status}</strong></div><div><span>Timestamp</span><strong>{row.timestamp}</strong></div></div><p className="priority-explanation">{row.priority_explanation}</p></div></div>
}

function AnalyticsPage({ locationData, trendData, riskData, bins, onNavigateToBins }) {
  const [location, setLocation] = useState('All Locations')
  const [risk, setRisk] = useState('All Risks')
  const [wasteType, setWasteType] = useState('All Types')
  const [dateRange, setDateRange] = useState('Last 7 Days')
  const [trendRange, setTrendRange] = useState('Last 7 Days')
  const [sortBy, setSortBy] = useState('Highest fill')
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [historicalTrend, setHistoricalTrend] = useState(trendData)
  const [refreshing, setRefreshing] = useState(false)

  const normalizeWaste = (value) => value === 'Food / Organic' ? 'Organic' : value === 'Mixed Waste' ? 'Mixed' : value
  const filteredBins = bins.filter((row) => {
    const locationMatch = location === 'All Locations' || row.location === location || (location === 'Hostel Block A' && row.location === 'Hostel Block 1') || (location === 'Hostel Block B' && row.location === 'Hostel Block 2')
    const riskMatch = risk === 'All Risks' || row.predicted_risk === risk
    const wasteMatch = wasteType === 'All Types' || row.waste_type === normalizeWaste(wasteType)
    return locationMatch && riskMatch && wasteMatch
  })

  useEffect(() => {
    const days = trendRange === 'Last 24 hours' || dateRange === 'Today' ? 1 : trendRange === 'Last 30 Days' || dateRange === 'Last 30 Days' ? 30 : 7
    setHistoricalTrend([])
    fetch(`${API}/analytics/trend?days=${days}`).then((response) => response.json()).then(setHistoricalTrend).catch(() => setHistoricalTrend([]))
  }, [dateRange, trendRange])

  const refresh = () => {
    setRefreshing(true)
    fetch(`${API}/bins`).then((response) => response.json()).then(() => window.location.reload()).finally(() => setRefreshing(false))
  }

  const locations = [...new Set(bins.map((row) => row.location))]
  const risks = ['High Risk', 'Medium Risk', 'Low Risk']
  const wasteTypes = [...new Set(bins.map((row) => row.waste_type))]
  const averageFill = filteredBins.length ? filteredBins.reduce((sum, row) => sum + row.current_fill_level, 0) / filteredBins.length : 0
  const riskCounts = risks.map((name) => ({ name, value: filteredBins.filter((row) => row.predicted_risk === name).length }))
  const locationStats = locations.map((name) => {
    const rows = filteredBins.filter((row) => row.location === name)
    return { location: name, average_fill: rows.length ? rows.reduce((sum, row) => sum + row.current_fill_level, 0) / rows.length : 0, highRisk: rows.filter((row) => row.predicted_risk === 'High Risk').length, rows }
  }).filter((row) => row.rows.length > 0)
  const sortedLocationStats = [...locationStats].sort((a, b) => sortBy === 'Lowest fill' ? a.average_fill - b.average_fill : sortBy === 'Most high-risk bins' ? b.highRisk - a.highRisk : sortBy === 'Alphabetical' ? a.location.localeCompare(b.location) : b.average_fill - a.average_fill)
  const wasteCounts = wasteTypes.map((name) => ({ name: name === 'Organic' ? 'Food / Organic' : name === 'Mixed' ? 'Mixed Waste' : name, value: filteredBins.filter((row) => row.waste_type === name).length }))
  const highestRiskLocation = locationStats.slice().sort((a, b) => b.highRisk - a.highRisk)[0]
  const commonWaste = wasteCounts.slice().sort((a, b) => b.value - a.value)[0]
  const urgentCount = filteredBins.filter((row) => ['P1', 'P2', 'P3'].includes(row.priority)).length
  const clearFilters = () => { setLocation('All Locations'); setRisk('All Risks'); setWasteType('All Types'); setDateRange('Last 7 Days'); setTrendRange('Last 7 Days') }
  const openLocation = (name) => setSelectedLocation(locationStats.find((row) => row.location === name) || null)

  return <section className="page-section analytics-page">
    <div className="section-title-row analytics-header"><div><span className="section-label">Analytics • Simulated Sensor Data</span><h2>Analytics Dashboard</h2><div className="sub-title">Understand campus waste patterns, identify high-risk locations, and evaluate AI-based collection priorities.</div></div><div className="analytics-header-actions"><span className="analytics-campus"><Building2 size={15} /> Spoorthy Engineering College</span><button className="secondary-button" onClick={refresh}><RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} /> Refresh Data</button><button className="primary-button" onClick={() => exportAnalyticsReport(filteredBins)}><Download size={15} /> Export Report</button></div></div>
    <div className="analytics-filter-bar"><label>Campus<strong>Spoorthy Engineering College</strong></label><label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}><option>All Locations</option>{LOCATION_OPTIONS.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Risk<select value={risk} onChange={(event) => setRisk(event.target.value)}><option>All Risks</option>{risks.map((item) => <option key={item}>{item}</option>)}</select></label><label>Waste Type<select value={wasteType} onChange={(event) => setWasteType(event.target.value)}><option>All Types</option>{WASTE_OPTIONS.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Date Range<select value={dateRange} onChange={(event) => { setDateRange(event.target.value); setTrendRange(event.target.value === 'Today' ? 'Last 24 hours' : event.target.value) }}><option>Today</option><option>Last 7 Days</option><option>Last 30 Days</option></select></label><button className="link-button" onClick={clearFilters}>Clear Filters</button></div>
    {filteredBins.length === 0 ? <div className="analytics-empty"><h3>No matching waste data found.</h3><p>Try changing or clearing your filters.</p><button className="secondary-button" onClick={clearFilters}>Clear Filters</button></div> : <>
      <div className="analytics-kpi-grid"><AnalyticsKpi label="Total Bins" value={filteredBins.length} onClick={() => setRisk('All Risks')} /><AnalyticsKpi label="Average Fill Level" value={`${averageFill.toFixed(1)}%`} onClick={() => setSortBy('Highest fill')} /><AnalyticsKpi label="High Risk Bins" value={riskCounts[0].value} onClick={() => setRisk('High Risk')} /><AnalyticsKpi label="Collection Required" value={urgentCount} onClick={() => setRisk('All Risks')} /><AnalyticsKpi label="Highest Risk Location" value={highestRiskLocation?.location || 'None'} onClick={() => highestRiskLocation && openLocation(highestRiskLocation.location)} /></div>
      <div className="analytics-grid enhanced-analytics-grid"><div className="panel analytics-panel"><div className="panel-head"><div><span className="section-label">Risk Distribution</span><h2>Predicted Risk</h2></div></div><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={riskCounts} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} onClick={(entry) => setRisk(entry.name)}>{riskCounts.map((entry, index) => <Cell key={entry.name} fill={['#e05656', '#f7b267', '#75b79e'][index]} />)}</Pie><Tooltip formatter={(value, name) => [`${value} bins (${((value / filteredBins.length) * 100).toFixed(1)}%)`, name]} /></PieChart></ResponsiveContainer><p className="chart-note">Risk level is based on the AI model's predicted probability of overflow and estimated time to overflow.</p></div>
        <div className="panel analytics-panel location-analytics-panel"><div className="panel-head"><div><span className="section-label">Location Analysis</span><h2>Average Fill by Location</h2></div><select className="mini-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option>Highest fill</option><option>Lowest fill</option><option>Most high-risk bins</option><option>Alphabetical</option></select></div><div className="clickable-location-list">{sortedLocationStats.map((row) => <button className="location-stat-row" key={row.location} onClick={() => openLocation(row.location)}><span>{row.location}</span><strong>{row.average_fill.toFixed(1)}%</strong><div className="location-fill-track"><i style={{ width: `${Math.min(row.average_fill, 100)}%` }}></i></div><small>{row.highRisk} high-risk bins</small></button>)}</div></div>
        <div className="panel analytics-panel"><div className="panel-head"><div><span className="section-label">Waste Composition</span><h2>Waste Type Distribution</h2></div></div><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={wasteCounts} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} onClick={(entry) => setWasteType(entry.name)}>{wasteCounts.map((entry, index) => <Cell key={entry.name} fill={['#0b6b58', '#8ab7a5', '#d2b48c', '#e05656'][index % 4]} />)}</Pie><Tooltip formatter={(value, name) => [`${value} bins (${((value / filteredBins.length) * 100).toFixed(1)}%)`, name]} /></PieChart></ResponsiveContainer><p className="chart-note">{commonWaste ? `${commonWaste.name} is the most frequently observed waste type in the selected data.` : 'No waste pattern available.'}</p></div>
        <div className="panel analytics-panel"><div className="panel-head"><div><span className="section-label">Historical Data</span><h2>Fill Level Over Time</h2></div><select className="mini-select" value={trendRange} onChange={(event) => setTrendRange(event.target.value)}><option>Last 24 hours</option><option>Last 7 Days</option><option>Last 30 Days</option></select></div>{historicalTrend.length ? <FillTrendChart trendData={historicalTrend} /> : <div className="limited-history">Historical data is limited in this prototype.</div>}<p className="chart-note">Historical readings use the shared simulated campus dataset; current KPI cards use the latest reading per bin.</p></div></div>
      <section className="ai-insights-panel"><div><span className="section-label">AI-Generated Waste Insights</span><h2>AI-Generated Waste Insights</h2></div><div className="insight-grid"><div><strong>AI Insight</strong><span>{locationStats.filter((row) => row.highRisk > 0).length} locations currently have bins above the high-risk threshold.</span></div><div><strong>Priority Insight</strong><span>{highestRiskLocation ? `${highestRiskLocation.location} has the highest concentration of high-risk bins.` : 'No high-risk location in this selection.'}</span></div><div><strong>Waste Pattern</strong><span>{commonWaste ? `${commonWaste.name} is the most frequently observed waste type.` : 'No waste pattern available.'}</span></div></div><p className="data-transparency"><strong>About this data</strong> This prototype uses sample/simulated campus waste data representing Spoorthy Engineering College. In a real deployment, bin readings would be received from IoT sensors through the backend and continuously processed by the AI prediction system.</p></section>
    </>}
    {selectedLocation && <AnalyticsLocationModal stats={selectedLocation} onClose={() => setSelectedLocation(null)} onView={() => { onNavigateToBins(selectedLocation.location); setSelectedLocation(null) }} />}
  </section>
}

function AnalyticsKpi({ label, value, onClick }) { return <button className="analytics-kpi-card" onClick={onClick}><span>{label}</span><strong>{value}</strong></button> }

function AnalyticsLocationModal({ stats, onClose, onView }) {
  const waste = stats.rows.reduce((result, row) => { result[row.waste_type] = (result[row.waste_type] || 0) + 1; return result }, {})
  const priorityBins = stats.rows.filter((row) => ['P1', 'P2', 'P3'].includes(row.priority)).sort((a, b) => (a.estimated_overflow_hours ?? 1e12) - (b.estimated_overflow_hours ?? 1e12)).slice(0, 5)
  return <div className="priority-modal-backdrop" onClick={onClose}><div className="priority-modal analytics-location-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div><span className="section-label">Location detail</span><h2>{stats.location}</h2></div><button className="icon-button" onClick={onClose}>×</button></div><div className="priority-detail-grid"><div><span>Total bins</span><strong>{stats.rows.length}</strong></div><div><span>Average fill</span><strong>{stats.average_fill.toFixed(1)}%</strong></div><div><span>Highest fill</span><strong>{Math.max(...stats.rows.map((row) => row.current_fill_level)).toFixed(1)}%</strong></div><div><span>High Risk</span><strong>{stats.rows.filter((row) => row.predicted_risk === 'High Risk').length}</strong></div><div><span>Medium Risk</span><strong>{stats.rows.filter((row) => row.predicted_risk === 'Medium Risk').length}</strong></div><div><span>Low Risk</span><strong>{stats.rows.filter((row) => row.predicted_risk === 'Low Risk').length}</strong></div></div><p className="chart-note">Waste distribution: {Object.entries(waste).map(([name, count]) => `${name} ${count}`).join(' • ')}</p><div className="location-priority-list"><strong>Top priority bins</strong>{priorityBins.length ? priorityBins.map((row) => <span key={row.bin_id}>{row.bin_id} • {row.priority} • {overflowLabel(row.estimated_overflow_hours)}</span>) : <span>No urgent collection bins.</span>}</div><button className="primary-button" onClick={onView}>View in Bin Monitoring</button></div></div>
}

function exportAnalyticsReport(rows) {
  const header = 'Bin ID,Location,Current Fill,Fill Rate,Waste Type,Risk,Priority\n'
  const csv = header + rows.map((row) => [row.bin_id, row.location, row.current_fill_level, row.fill_rate, row.waste_type, row.predicted_risk, row.priority].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'spoorthy-analytics-report.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function PieChartWidget({ bins }) {
  const counts = bins.reduce((result, row) => {
    const name = row.waste_type === 'Organic' ? 'Food / Organic' : row.waste_type === 'Mixed' ? 'Mixed Waste' : row.waste_type
    result[name] = (result[name] || 0) + 1
    return result
  }, {})
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={30} outerRadius={80} fill="#0b6b58" label>
          {data.map((entry, idx) => <Cell key={idx} fill={['#0b6b58', '#8ab7a5', '#d2b48c', '#e05656'][idx]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

function RoutePage({ routes, priority }) {
  const [selectedStop, setSelectedStop] = useState(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [routeStatus, setRouteStatus] = useState('Awaiting Approval')
  const routeIds = (routes?.route || []).filter((item) => item !== 'Depot')
  const byId = new Map(priority.map((row) => [row.bin_id, row]))
  const stops = routeIds.map((binId) => byId.get(binId)).filter(Boolean)
  const highPriorityCount = stops.filter((row) => ['P1', 'P2'].includes(row.priority)).length
  const highestFill = stops.length ? Math.max(...stops.map((row) => row.current_fill_level)) : 0
  const reasonFor = (row) => row.current_fill_level >= 95
    ? `${row.bin_id} is prioritized because its fill level is critically high.`
    : row.estimated_overflow_hours != null && row.estimated_overflow_hours <= 3
      ? `${row.bin_id} is prioritized because its predicted overflow time is very short.`
      : `${row.bin_id} is prioritized from its ${row.predicted_risk} prediction and ${row.priority} collection priority.`

  const approve = () => setRouteStatus('Route Approved')
  return <section className="page-section route-page">
    <div className="section-title-row"><div><span className="section-label">Collection Routes • Simulated Sensor Data</span><h2>Smart Collection Routes</h2><div className="sub-title">AI-assisted prototype route recommendation for Spoorthy Engineering College. This is not real-time GPS navigation.</div></div><span className={`route-status ${routeStatus === 'Route Approved' ? 'approved' : ''}`}>{routeStatus}</span></div>
    <div className="route-kpi-grid"><RouteKpi label="Bins in Recommended Route" value={stops.length} /><RouteKpi label="High Priority Bins" value={highPriorityCount} /><RouteKpi label="Highest Fill Level" value={`${highestFill.toFixed(1)}%`} /><RouteKpi label="Route Status" value={routeStatus} /></div>
    {stops.length === 0 ? <div className="analytics-empty"><h3>No urgent collection route is currently recommended.</h3><p>The route is generated only when the priority engine returns collection candidates.</p></div> : <>
      <div className="route-layout"><div className="route-list"><div className="route-list-title">Recommended stop sequence</div>{stops.map((row, idx) => <button className="route-stop-button" key={row.bin_id} onClick={() => setSelectedStop(row)}><span>{String(idx + 1).padStart(2, '0')}</span><div><strong>{row.bin_id}</strong><small>{row.location} • {row.current_fill_level.toFixed(1)}% full</small><small><b className="route-risk">{row.predicted_risk}</b> <b>{row.priority}</b> • Overflow: {overflowLabel(row.estimated_overflow_hours)}</small></div><ArrowRight size={16} /></button>)}</div><div className="route-card"><div className="route-card-title">Recommended Route</div><div className="route-card-text">{routes?.explanation || 'The route is derived from current collection-priority results. Human administrator approval is required.'}</div><div className="route-card-actions"><button className="primary-button" onClick={approve}>{routeStatus === 'Route Approved' ? 'Route Approved' : 'Approve Route'}</button><button className="secondary-button" onClick={() => setReviewOpen(true)}>Review Route</button></div>{routeStatus === 'Route Approved' && <div className="route-confirmation">Route approved by administrator.</div>}</div></div>
      <div className="route-detail-grid"><section className="panel route-process"><div className="section-label">Decision flow</div><h2>How was this route generated?</h2><div className="route-process-steps">{['Analyze bin readings', 'Predict overflow risk', 'Rank collection priority', 'Select high-priority bins', 'Generate prototype route', 'Human administrator reviews route'].map((step, idx) => <div key={step}><span>{idx + 1}</span>{step}</div>)}</div><p>The route recommendation is generated from the collection-priority results. Bins with higher predicted overflow risk, higher fill levels and shorter estimated overflow times receive higher collection priority.</p></section><section className="panel"><div className="section-label">Explainability</div><h2>Why these bins?</h2><div className="route-reasons">{stops.slice(0, 5).map((row) => <p key={row.bin_id}>{reasonFor(row)}</p>)}</div></section></div>
      <section className="prototype-route-map"><div><span className="section-label">Prototype campus route</span><h2>Campus stop overview</h2><p>Prototype campus route — not GPS navigation. Locations are shown as an ordered visual sequence, not geographic coordinates.</p></div><div className="route-map-track"><span className="map-depot">Depot</span>{stops.slice(0, 8).map((row, idx) => <div className="map-marker" key={row.bin_id}><span>{idx + 1}</span><small>{row.location}</small></div>)}</div></section>
      <section className="route-notices"><div><strong>Prototype Data Notice</strong><span>This internship prototype uses simulated campus waste data representing Spoorthy Engineering College. In a real deployment, IoT sensors would send bin readings to the backend, where they would be processed by the prediction model before collection recommendations are generated.</span></div><div><strong>Future Enhancement</strong><span>Future versions can integrate GPS coordinates, road-network data and route-optimization algorithms to calculate more efficient vehicle routes across multiple campuses.</span></div></section>
    </>}
    {selectedStop && <RouteStopModal row={selectedStop} onClose={() => setSelectedStop(null)} />}
    {reviewOpen && <RouteReviewModal stops={stops} onClose={() => setReviewOpen(false)} onApprove={() => { approve(); setReviewOpen(false) }} />}
  </section>
}

function RouteKpi({ label, value }) { return <div className="route-kpi"><span>{label}</span><strong>{value}</strong></div> }

function RouteStopModal({ row, onClose }) { return <div className="priority-modal-backdrop" onClick={onClose}><div className="priority-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div><span className="section-label">Route stop detail</span><h2>{row.bin_id}</h2></div><button className="icon-button" onClick={onClose}>×</button></div><div className="priority-detail-grid"><div><span>Location</span><strong>{row.location}</strong></div><div><span>Current fill</span><strong>{row.current_fill_level.toFixed(1)}%</strong></div><div><span>Fill rate</span><strong>{row.fill_rate.toFixed(2)}% / hour</strong></div><div><span>Predicted risk</span><strong>{row.predicted_risk}</strong></div><div><span>Priority</span><strong>{row.priority}</strong></div><div><span>Estimated overflow</span><strong>{overflowLabel(row.estimated_overflow_hours)}</strong></div><div><span>Waste type</span><strong>{row.waste_type}</strong></div><div><span>Timestamp</span><strong>{row.timestamp}</strong></div></div><p className="priority-explanation">{row.priority_explanation}</p></div></div> }

function RouteReviewModal({ stops, onClose, onApprove }) { return <div className="priority-modal-backdrop" onClick={onClose}><div className="priority-modal route-review-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div><span className="section-label">Human review</span><h2>Review Route</h2></div><button className="icon-button" onClick={onClose}>×</button></div><p className="sub-title">Recommended stops are generated from the existing collection-priority results.</p><div className="review-route-list">{stops.map((row, idx) => <div key={row.bin_id}><strong>{String(idx + 1).padStart(2, '0')} {row.bin_id}</strong><span>{row.priority} • {row.predicted_risk} • {row.current_fill_level.toFixed(1)}% • {overflowLabel(row.estimated_overflow_hours)}</span></div>)}</div><button className="primary-button" onClick={onApprove}>Approve Route</button></div></div> }

function AssistantPage() {
  const [question, setQuestion] = useState('Which bins need immediate collection?')
  const [answer, setAnswer] = useState('Assistant: Based on the model prediction and priority scoring engine:')
  const [loading, setLoading] = useState(false)

  const ask = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const payload = await response.json()
      setAnswer(payload.answer)
    } catch (e) {
      setAnswer('Unable to retrieve latest bin data.')
    }
    setLoading(false)
  }

  return (
    <section className="page-section">
      <div className="section-title-row">
        <div>
          <span className="section-label">AI Waste Assistant</span>
          <h2>AI Waste Assistant</h2>
          <div className="sub-title">Ask questions about campus waste, bin risk, and collection priorities.</div>
        </div>
      </div>
      <div className="chatbox">
        <div className="chat-bubble assistant-bubble">
          <span className="assistant-label">Assistant</span>
          <span>{answer}</span>
        </div>
        <div className="chat-bubble user-bubble">
          <span className="user-label">You</span>
          <span>{question}</span>
        </div>
        <div className="chat-input-row">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="primary-button" onClick={ask}>{loading ? 'Thinking...' : 'Ask'}</button>
        </div>
      </div>
    </section>
  )
}

function ReportsPage({ dashboard }) {
  const reportKpis = dashboard?.kpis || {}
  return (
    <section className="page-section">
      <div className="section-title-row">
        <div>
          <span className="section-label">Reports</span>
          <h2>Reports</h2>
        </div>
      </div>
      <div className="report-grid">
        <div className="report-card">
          <div className="report-title">Daily Waste Report</div>
          <div className="report-meta">Total bins monitored: {reportKpis.total_bins ?? 0}</div>
          <div className="report-meta">High-risk bins: {reportKpis.high_risk ?? 0}</div>
          <button className="secondary-button small-button">Download CSV</button>
          <button className="secondary-button small-button">PDF (UI)</button>
        </div>
        <div className="report-card">
          <div className="report-title">Weekly Waste Report</div>
          <div className="report-meta">Collections required: {reportKpis.collection_required ?? 0}</div>
          <button className="secondary-button small-button">Download CSV</button>
        </div>
        <div className="report-card">
          <div className="report-title">Monthly Waste Report</div>
          <div className="report-meta">Average fill level: {(reportKpis.average_fill_level ?? 0).toFixed(1)}%</div>
          <button className="secondary-button small-button">Download PDF</button>
        </div>
      </div>
    </section>
  )
}

function SettingsPage() {
  return (
    <section className="page-section">
      <div className="section-title-row">
        <div>
          <span className="section-label">Settings</span>
          <h2>Settings</h2>
        </div>
      </div>
      <div className="settings-grid">
        <div className="settings-card">
          <h3>System Settings</h3>
          <div><span>AI System Online</span></div>
          <div><span>Risk Threshold: 70%</span></div>
        </div>
        <div className="settings-card">
          <h3>Notification Settings</h3>
          <div><span>Email alerts: Enabled</span></div>
        </div>
        <div className="settings-card">
          <h3>Responsible AI</h3>
          <ul>
            <li>Human oversight</li>
            <li>Explainable prioritization</li>
            <li>Transparent scoring</li>
            <li>Data privacy</li>
            <li>No autonomous collection decisions</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function LoadingSkeleton() {
  return <div className="loading-card">Loading campus data...</div>
}

export default App
