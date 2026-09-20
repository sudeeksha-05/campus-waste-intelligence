import React, { useEffect, useState, useRef } from 'react'
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
  Map as MapIcon,
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
  Check,
  Clock,
  Compass,
  Info,
  ChevronRight,
  ShieldCheck,
  Navigation,
  FileText,
  Printer,
  TrendingUp,
  Layers,
  Mail,
  Sliders,
  X,
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
  { label: 'Collection Routes', icon: MapIcon, page: 'routes' },
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

  // System Settings & Notification Preferences (functional with localStorage persistence)
  const [riskThreshold, setRiskThreshold] = useState(() => {
    const saved = localStorage.getItem('campus_waste_risk_threshold')
    return saved ? Number(saved) : 70
  })
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    const saved = localStorage.getItem('campus_waste_notification_prefs')
    return saved
      ? JSON.parse(saved)
      : {
          emailAlerts: false,
          highRiskAlerts: true,
          overflowAlerts: true,
          priorityAlerts: true,
        }
  })
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    const saved = localStorage.getItem('campus_waste_read_notifications')
    return saved ? JSON.parse(saved) : []
  })
  const [clearedNotifications, setClearedNotifications] = useState(() => {
    return localStorage.getItem('campus_waste_cleared_notifications') === 'true'
  })

  const updateRiskThreshold = (val) => {
    const clamped = Math.min(100, Math.max(50, Number(val)))
    setRiskThreshold(clamped)
    localStorage.setItem('campus_waste_risk_threshold', String(clamped))
  }

  const updateNotificationPrefs = (updater) => {
    setNotificationPrefs((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      localStorage.setItem('campus_waste_notification_prefs', JSON.stringify(next))
      setClearedNotifications(false)
      localStorage.setItem('campus_waste_cleared_notifications', 'false')
      return next
    })
  }

  const markNotificationRead = (id) => {
    setReadNotificationIds((prev) => {
      const next = [...new Set([...prev, id])]
      localStorage.setItem('campus_waste_read_notifications', JSON.stringify(next))
      return next
    })
  }

  const markAllNotificationsRead = () => {
    const allIds = activeNotifications.map((n) => n.id)
    setReadNotificationIds(allIds)
    localStorage.setItem('campus_waste_read_notifications', JSON.stringify(allIds))
  }

  const clearAllNotifications = () => {
    setClearedNotifications(true)
    localStorage.setItem('campus_waste_cleared_notifications', 'true')
  }

  // Dynamically generate real in-app notifications strictly from current project data & preferences
  const activeNotifications = React.useMemo(() => {
    if (clearedNotifications) return []
    const list = []

    if (notificationPrefs.highRiskAlerts && bins.length > 0) {
      const highCount = bins.filter(
        (b) => b.predicted_risk === 'High Risk' || (b.current_fill_level || 0) >= riskThreshold
      ).length
      if (highCount > 0) {
        list.push({
          id: 'alert-high-risk',
          title: 'High-Risk Bins Detected',
          message: `${highCount} bins are currently classified as High Risk (exceeding ${riskThreshold}% threshold).`,
          time: 'Active Telemetry',
          severity: 'high',
        })
      }
    }

    if (notificationPrefs.overflowAlerts && bins.length > 0) {
      const overflowCount = bins.filter(
        (b) =>
          (b.current_fill_level || 0) >= 98 ||
          (b.estimated_overflow_hours !== null && b.estimated_overflow_hours <= 1.0)
      ).length
      if (overflowCount > 0) {
        list.push({
          id: 'alert-overflow',
          title: 'Imminent Overflow Warning',
          message: `${overflowCount} bins are at critical capacity (fill >= 98% or estimated overflow < 1.0h).`,
          time: 'Critical',
          severity: 'critical',
        })
      }
    }

    if (notificationPrefs.priorityAlerts && priority.length > 0) {
      const p1Count = priority.filter((p) => p.priority === 'P1').length
      const p2Count = priority.filter((p) => p.priority === 'P2').length
      if (p1Count > 0 || p2Count > 0) {
        list.push({
          id: 'alert-priority',
          title: 'Immediate Collection Required',
          message: `${p1Count} bins require immediate P1 dispatch and ${p2Count} bins require P2 priority collection.`,
          time: 'Action Required',
          severity: 'urgent',
        })
      }
    }

    // System Status
    list.push({
      id: 'system-online',
      title: 'AI Decision System Online',
      message: 'Decision Tree ML classifier and Collection Priority Engine are active for Spoorthy Engineering College.',
      time: 'Operational',
      severity: 'info',
    })

    return list
  }, [bins, priority, riskThreshold, notificationPrefs, clearedNotifications])

  const unreadNotificationsCount = activeNotifications.filter(
    (n) => !readNotificationIds.includes(n.id)
  ).length

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
        <Header
          page={page}
          user={auth.user}
          onLogout={handleLogout}
          selectedCampus={selectedCampus}
          onCampusChange={setSelectedCampus}
          notifications={activeNotifications}
          unreadCount={unreadNotificationsCount}
          readNotificationIds={readNotificationIds}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onClearNotifications={clearAllNotifications}
        />
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
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'reports' && (
            <ReportsPage
              dashboard={dashboard}
              bins={bins}
              priority={priority}
              locationData={locationData}
              trendData={trendData}
              riskData={riskData}
              kpis={kpis}
              selectedCampus={selectedCampus}
            />
          )}
          {!loading && !FUTURE_CAMPUSES.has(selectedCampus) && page === 'settings' && (
            <SettingsPage
              riskThreshold={riskThreshold}
              onRiskThresholdChange={updateRiskThreshold}
              notificationPrefs={notificationPrefs}
              onNotificationPrefsChange={updateNotificationPrefs}
              selectedCampus={selectedCampus}
            />
          )}
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

function Header({
  page,
  user,
  onLogout,
  selectedCampus,
  onCampusChange,
  notifications = [],
  unreadCount = 0,
  readNotificationIds = [],
  onMarkRead,
  onMarkAllRead,
  onClearNotifications,
}) {
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNotifications])

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
        <label className="campus-selector">
          <Building2 size={16} />
          <span>Campus</span>
          <select value={selectedCampus} onChange={(event) => onCampusChange(event.target.value)}>
            {CAMPUS_OPTIONS.map((campus) => (
              <option key={campus} value={campus}>
                {campus}{campus !== ACTIVE_CAMPUS ? ' (Future)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="search-wrap">
          <Search size={15} />
          <input placeholder="Search" />
        </div>

        {/* Notifications Bell with unread counter and interactive dropdown */}
        <div className="notifications-bell-container" ref={notifRef}>
          <button
            className={`icon-button bell-button ${showNotifications ? 'active' : ''}`}
            onClick={() => setShowNotifications((prev) => !prev)}
            title="System Notifications"
            aria-label="System Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="bell-badge" title={`${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown-menu">
              <div className="notif-dropdown-header">
                <div className="notif-dropdown-title-wrap">
                  <span className="notif-dropdown-title">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="notif-unread-count-pill">{unreadCount} New</span>
                  ) : (
                    <span className="notif-all-caught-up">All read</span>
                  )}
                </div>
                <div className="notif-dropdown-actions">
                  {unreadCount > 0 && (
                    <button
                      className="notif-action-btn"
                      onClick={onMarkAllRead}
                      title="Mark all as read"
                    >
                      <Check size={13} /> Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      className="notif-action-btn"
                      onClick={onClearNotifications}
                      title="Clear notifications"
                    >
                      <X size={13} /> Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="notif-list-body">
                {notifications.length === 0 ? (
                  <div className="notif-empty-state">
                    <CheckCircle2 size={30} className="notif-empty-icon" />
                    <strong>All Caught Up</strong>
                    <p>No active alerts. All campus bins are operating within standard parameters.</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isRead = readNotificationIds.includes(notif.id)
                    return (
                      <div
                        key={notif.id}
                        className={`notif-item notif-${notif.severity} ${isRead ? 'read' : 'unread'}`}
                        onClick={() => !isRead && onMarkRead && onMarkRead(notif.id)}
                      >
                        <div className="notif-item-top">
                          <div className="notif-title-row">
                            {!isRead && <span className="notif-unread-dot" />}
                            <span className="notif-item-title">{notif.title}</span>
                          </div>
                          <span className={`notif-severity-badge severity-${notif.severity}`}>
                            {notif.time}
                          </span>
                        </div>
                        <p className="notif-item-message">{notif.message}</p>
                        {!isRead && (
                          <div className="notif-item-footer">
                            <button
                              className="notif-mark-read-link"
                              onClick={(e) => {
                                e.stopPropagation()
                                onMarkRead && onMarkRead(notif.id)
                              }}
                            >
                              Mark as read
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="notif-dropdown-footer">
                <span className="notif-footer-note">Telemetry derived in real time from AI Decision Engine</span>
              </div>
            </div>
          )}
        </div>

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
  const [filterLocation, setFilterLocation] = useState('All')
  const [showAllStops, setShowAllStops] = useState(false)

  // Derive route stops from routes API and priority data
  const routeIds = (routes?.route || []).filter((item) => item !== 'Depot')
  const byId = new Map((priority || []).map((row) => [row.bin_id, row]))
  let stops = routeIds.map((binId) => byId.get(binId)).filter(Boolean)

  // Fallback: If route API returns empty but priority has urgent bins
  if (stops.length === 0 && (priority || []).length > 0) {
    const urgentBins = priority.filter((b) => ['P1', 'P2'].includes(b.priority))
    if (urgentBins.length > 0) {
      stops = urgentBins
    }
  }

  // Filtered stops by campus location
  const filteredStops = filterLocation === 'All'
    ? stops
    : stops.filter((s) => s.location === filterLocation)

  const displayedStops = showAllStops ? filteredStops : filteredStops.slice(0, 10)

  // KPI calculations
  const highPriorityCount = stops.filter(
    (row) => ['P1', 'P2'].includes(row.priority) || row.predicted_risk === 'High Risk'
  ).length
  const highestFill = stops.length ? Math.max(...stops.map((row) => row.current_fill_level)) : 0

  // Dynamic reasoning generator (Requirement 4)
  const reasonFor = (row) => {
    if (!row) return ''
    if (row.current_fill_level >= 95) {
      return `${row.bin_id} is prioritized because its fill level is critically high (${row.current_fill_level.toFixed(1)}%).`
    }
    if (row.estimated_overflow_hours != null && row.estimated_overflow_hours <= 1.0) {
      return `${row.bin_id} is prioritized because its predicted overflow time is very short (${row.estimated_overflow_hours.toFixed(1)} hours).`
    }
    if (row.estimated_overflow_hours != null && row.estimated_overflow_hours <= 3.0) {
      return `${row.bin_id} is prioritized because it is projected to overflow within ${row.estimated_overflow_hours.toFixed(1)} hours.`
    }
    if (row.fill_rate >= 2.0) {
      return `${row.bin_id} is prioritized due to rapid fill accumulation (${row.fill_rate.toFixed(2)}%/hr) and elevated overflow risk.`
    }
    if (row.predicted_risk === 'High Risk') {
      return `${row.bin_id} is prioritized based on High Risk ML prediction and urgent ${row.priority} collection status.`
    }
    return `${row.bin_id} is prioritized from its ${row.priority} queue ranking and ${row.predicted_risk} ML classification.`
  }

  const approve = () => setRouteStatus('Route Approved')

  const uniqueLocations = ['All', ...new Set(stops.map((s) => s.location))]

  return (
    <section className="page-section route-page">
      {/* Header Row */}
      <div className="section-title-row">
        <div>
          <span className="section-label">Collection Routes • AI Decision Support</span>
          <h2>Smart Collection Routes</h2>
          <div className="sub-title">
            AI-assisted prototype route recommendation for Spoorthy Engineering College. This is not real-time GPS navigation.
          </div>
        </div>
        <div className="route-header-status-wrap">
          <span className={`route-status-pill ${routeStatus === 'Route Approved' ? 'approved' : 'pending'}`}>
            {routeStatus === 'Route Approved' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            <span>{routeStatus}</span>
          </span>
        </div>
      </div>

      {/* Concept Pipeline Architecture Banner (Requirement 12) */}
      <div className="route-pipeline-banner">
        <div className="pipeline-header">
          <span className="pipeline-dot"></span>
          <span className="pipeline-title">AI Decision-Support Pipeline Architecture</span>
        </div>
        <div className="pipeline-flow">
          <div className="pipeline-step">
            <span className="step-tag">Step 1</span>
            <div className="step-name">DATA</div>
            <small>IoT Sensor Readings</small>
          </div>
          <div className="pipeline-arrow">↓</div>
          <div className="pipeline-step">
            <span className="step-tag">Step 2</span>
            <div className="step-name">AI PREDICTION</div>
            <small>ML Overflow Risk</small>
          </div>
          <div className="pipeline-arrow">↓</div>
          <div className="pipeline-step">
            <span className="step-tag">Step 3</span>
            <div className="step-name">COLLECTION PRIORITY</div>
            <small>Urgency Engine (P1-P4)</small>
          </div>
          <div className="pipeline-arrow">↓</div>
          <div className="pipeline-step highlight">
            <span className="step-tag">Step 4</span>
            <div className="step-name">ROUTE RECOMMENDATION</div>
            <small>AI-Assisted Prototype</small>
          </div>
          <div className="pipeline-arrow">↓</div>
          <div className="pipeline-step">
            <span className="step-tag">Step 5</span>
            <div className="step-name">HUMAN APPROVAL</div>
            <small>Administrator Sign-off</small>
          </div>
        </div>
      </div>

      {/* Requirement 1 - Route Summary KPI Cards */}
      <div className="route-kpi-grid">
        <RouteKpiCard
          icon={<MapPin size={22} />}
          label="Bins in Recommended Route"
          value={stops.length}
          badge="Active Stops"
        />
        <RouteKpiCard
          icon={<AlertTriangle size={22} />}
          label="High Priority Bins"
          value={highPriorityCount}
          badge="P1 / P2 Urgent"
          variant="danger"
        />
        <RouteKpiCard
          icon={<Trash2 size={22} />}
          label="Highest Fill Level"
          value={stops.length ? `${highestFill.toFixed(1)}%` : '0.0%'}
          badge="Peak Capacity"
          variant="warning"
        />
        <RouteKpiCard
          icon={routeStatus === 'Route Approved' ? <CheckCircle2 size={22} /> : <Clock size={22} />}
          label="Route Status"
          value={routeStatus}
          badge={routeStatus === 'Route Approved' ? 'Approved' : 'Awaiting Review'}
          variant={routeStatus === 'Route Approved' ? 'success' : 'pending'}
        />
      </div>

      {/* Requirement 6 - Approval Confirmation Message */}
      {routeStatus === 'Route Approved' && (
        <div className="route-approval-banner">
          <div className="approval-banner-icon">
            <CheckCircle2 size={24} />
          </div>
          <div className="approval-banner-content">
            <strong>Route approved by administrator.</strong>
            <span>
              Human administrator review is complete. Route recommendation is verified for sanitation crew assignment.
              In accordance with safety guidelines, vehicles are not automatically dispatched.
            </span>
          </div>
          <button
            className="secondary-button banner-reset-btn"
            onClick={() => setRouteStatus('Awaiting Approval')}
            title="Reset to Awaiting Approval for demonstration"
          >
            Reset Status
          </button>
        </div>
      )}

      {/* Requirement 9 - Empty State */}
      {stops.length === 0 ? (
        <div className="route-empty-card">
          <ClipboardCheck size={52} className="empty-icon" />
          <h3>No urgent collection route is currently recommended.</h3>
          <p>
            The collection priority engine has not identified any high-priority bins requiring urgent collection.
            All monitored bins at Spoorthy Engineering College are operating within safe fill thresholds.
          </p>
        </div>
      ) : (
        <>
          {/* Main Layout: Left = Route Stop Sequence List, Right = Recommendation Card & Actions */}
          <div className="route-layout">
            {/* Requirement 2 - Route List */}
            <div className="route-list-container">
              <div className="route-list-header">
                <div>
                  <div className="route-list-title">Recommended Stop Sequence</div>
                  <div className="route-list-subtitle">
                    Showing {displayedStops.length} of {filteredStops.length} recommended stops
                  </div>
                </div>
                {uniqueLocations.length > 2 && (
                  <div className="route-filter-select">
                    <Filter size={14} />
                    <select
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                    >
                      {uniqueLocations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc === 'All' ? 'All Locations' : loc}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="route-stops-scroll">
                {displayedStops.map((row, idx) => (
                  <button
                    className={`route-stop-card ${selectedStop?.bin_id === row.bin_id ? 'active-stop' : ''}`}
                    key={row.bin_id}
                    onClick={() => setSelectedStop(row)}
                    title="Click to view full bin details and priority reasoning"
                  >
                    <div className="stop-number-badge">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="stop-main-info">
                      <div className="stop-top-line">
                        <strong className="stop-bin-id">{row.bin_id}</strong>
                        <span className="stop-location-text">{row.location}</span>
                      </div>
                      <div className="stop-fill-row">
                        <span className="stop-fill-text">{row.current_fill_level.toFixed(1)}% full</span>
                        <div className="stop-fill-bar-mini">
                          <i
                            style={{
                              width: `${Math.min(row.current_fill_level, 100)}%`,
                              backgroundColor: row.current_fill_level >= 90 ? '#e05656' : row.current_fill_level >= 75 ? '#f7b267' : '#0b6b58',
                            }}
                          ></i>
                        </div>
                      </div>
                      <div className="stop-badge-line">
                        <span className={`risk-badge small ${row.predicted_risk.toLowerCase().replace(' ', '-')}`}>
                          {row.predicted_risk}
                        </span>
                        <span className="priority-tag small">{row.priority}</span>
                        <span className="stop-overflow-tag">
                          Overflow: {overflowLabel(row.estimated_overflow_hours)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="stop-chevron" />
                  </button>
                ))}
              </div>

              {filteredStops.length > 10 && (
                <div className="route-list-footer">
                  <button
                    className="secondary-button small-button show-more-btn"
                    onClick={() => setShowAllStops((prev) => !prev)}
                  >
                    {showAllStops ? 'Show top 10 stops' : `Show all ${filteredStops.length} stops`}
                  </button>
                </div>
              )}
            </div>

            {/* Right Card: Decision Support & Route Action Controls (Requirements 5 & 6) */}
            <div className="route-card-column">
              <div className="route-card">
                <div className="route-card-kicker">
                  <span className="status-dot"></span> AI-Assisted Recommendation
                </div>
                <h3 className="route-card-title">Recommended Route</h3>
                <p className="route-card-text">
                  This route is an AI-assisted prototype route recommendation generated from ML overflow-risk predictions
                  and collection prioritization for Spoorthy Engineering College. It does not guarantee a minimum-travel route
                  or operational vehicle feasibility. The final collection dispatch must be reviewed and approved by the administrator.
                </p>

                <div className="route-quick-stats">
                  <div className="quick-stat-item">
                    <span>Starting Point</span>
                    <strong>Central Depot</strong>
                  </div>
                  <div className="quick-stat-item">
                    <span>Stops in Queue</span>
                    <strong>{stops.length} bins</strong>
                  </div>
                  <div className="quick-stat-item">
                    <span>Critical Bins (&ge;90%)</span>
                    <strong>{stops.filter((s) => s.current_fill_level >= 90).length}</strong>
                  </div>
                  <div className="quick-stat-item">
                    <span>Review Status</span>
                    <strong className={routeStatus === 'Route Approved' ? 'text-success' : 'text-pending'}>
                      {routeStatus}
                    </strong>
                  </div>
                </div>

                <div className="route-card-actions">
                  <button
                    className="secondary-button route-action-review"
                    onClick={() => setReviewOpen(true)}
                  >
                    <Eye size={16} /> Review Route
                  </button>
                  <button
                    className={`primary-button route-action-approve ${routeStatus === 'Route Approved' ? 'approved' : ''}`}
                    onClick={approve}
                  >
                    {routeStatus === 'Route Approved' ? (
                      <>
                        <CheckCircle2 size={16} /> Route Approved
                      </>
                    ) : (
                      <>
                        <Check size={16} /> Approve Route
                      </>
                    )}
                  </button>
                </div>

                {routeStatus === 'Route Approved' && (
                  <div className="route-approved-pill">
                    <CheckCircle2 size={16} /> Route approved by administrator. Ready for manual dispatch.
                  </div>
                )}
              </div>

              {/* Requirement 4 - Route Reasoning ("Why these bins?") */}
              <section className="panel route-reasons-panel">
                <div className="panel-head">
                  <div>
                    <span className="section-label">Explainable AI</span>
                    <h2>Why these bins?</h2>
                  </div>
                </div>
                <p className="route-reasons-intro">
                  Dynamic statements generated from actual bin fill levels, fill rates, and ML predictions:
                </p>
                <div className="route-reasons-list">
                  {stops.slice(0, 5).map((row, idx) => (
                    <div
                      className="route-reason-card"
                      key={row.bin_id}
                      onClick={() => setSelectedStop(row)}
                      title="Click to view bin details"
                    >
                      <div className="reason-header">
                        <span className="reason-stop-idx">#{String(idx + 1).padStart(2, '0')}</span>
                        <strong className="reason-bin-id">{row.bin_id}</strong>
                        <span className="reason-loc">{row.location}</span>
                        <span className={`risk-badge mini ${row.predicted_risk.toLowerCase().replace(' ', '-')}`}>
                          {row.predicted_risk}
                        </span>
                        <span className="priority-tag mini">{row.priority}</span>
                      </div>
                      <p className="reason-text">{reasonFor(row)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* Requirement 3 - AI Route Explanation */}
          <section className="panel route-explanation-panel">
            <div className="panel-head">
              <div>
                <span className="section-label">Decision Workflow</span>
                <h2>How was this route generated?</h2>
              </div>
            </div>

            <div className="route-process-stepper">
              <div className="process-step-item">
                <span className="process-step-num">1</span>
                <strong className="process-step-title">Analyze bin readings</strong>
                <p className="process-step-sub">Evaluates current fill level, fill rate, and historical volume trends.</p>
              </div>
              <div className="process-step-item">
                <span className="process-step-num">2</span>
                <strong className="process-step-title">Predict overflow risk</strong>
                <p className="process-step-sub">ML Decision Tree classifier predicts overflow likelihood (High, Medium, Low).</p>
              </div>
              <div className="process-step-item">
                <span className="process-step-num">3</span>
                <strong className="process-step-title">Rank collection priority</strong>
                <p className="process-step-sub">Priority Engine assigns urgency classes (P1 to P4) based on risk and overflow time.</p>
              </div>
              <div className="process-step-item">
                <span className="process-step-num">4</span>
                <strong className="process-step-title">Select high-priority bins</strong>
                <p className="process-step-sub">Filters urgent bins requiring prompt collection (P1 & P2 candidates).</p>
              </div>
              <div className="process-step-item">
                <span className="process-step-num">5</span>
                <strong className="process-step-title">Generate prototype route</strong>
                <p className="process-step-sub">Sequences high-priority bins from Central Depot using campus proximity order.</p>
              </div>
              <div className="process-step-item">
                <span className="process-step-num">6</span>
                <strong className="process-step-title">Human administrator reviews route</strong>
                <p className="process-step-sub">Supervisor inspects stops and approves recommendation before dispatch.</p>
              </div>
            </div>

            <div className="route-explanation-callout">
              <Info size={22} className="callout-icon" />
              <div>
                <p className="callout-primary-text">
                  “The route recommendation is generated from the collection-priority results. Bins with higher predicted overflow risk, higher fill levels and shorter estimated overflow times receive higher collection priority.”
                </p>
                <p className="callout-secondary-text">
                  Note: This route is an AI-assisted decision support recommendation and does not claim to be a guaranteed shortest path or municipal routing system.
                </p>
              </div>
            </div>
          </section>

          {/* Requirement 7 - Prototype Campus Map */}
          <section className="panel prototype-campus-map-panel">
            <div className="panel-head map-panel-head">
              <div>
                <span className="section-label">Campus Schematic Visualization</span>
                <h2>Campus Stop Overview</h2>
                <div className="map-disclaimer-pill">
                  <MapPin size={14} />
                  <span>Prototype campus route — not GPS navigation.</span>
                </div>
              </div>
              <div className="map-legend-strip">
                <div className="legend-entry">
                  <span className="legend-dot depot"></span> Depot (Origin)
                </div>
                <div className="legend-entry">
                  <span className="legend-dot high-risk"></span> High Risk Bin
                </div>
                <div className="legend-entry">
                  <span className="legend-dot medium-risk"></span> Medium Risk Bin
                </div>
                <div className="legend-entry">
                  <span className="legend-line"></span> Route Path
                </div>
              </div>
            </div>
            <p className="map-explanatory-note">
              Locations use the existing Spoorthy Engineering College prototype coordinates. Stop markers indicate recommended visit sequence starting from Central Depot.
            </p>

            <div className="campus-map-wrapper">
              <CampusRouteSvg stops={stops} onSelectStop={setSelectedStop} />
            </div>
          </section>

          {/* Requirements 10 & 11 - Transparency & Future Extension */}
          <section className="route-notices-container">
            <div className="route-notice-card">
              <div className="notice-head">
                <Info size={18} className="notice-icon" />
                <strong>Prototype Data Notice</strong>
              </div>
              <p>
                This internship prototype uses simulated campus waste data representing Spoorthy Engineering College. In a real deployment, IoT sensors would send bin readings to the backend, where they would be processed by the prediction model before collection recommendations are generated.
              </p>
            </div>

            <div className="route-notice-card">
              <div className="notice-head">
                <Compass size={18} className="notice-icon" />
                <strong>Future Enhancement</strong>
              </div>
              <p>
                Future versions can integrate GPS coordinates, road-network data and route-optimization algorithms to calculate more efficient vehicle routes across multiple campuses.
              </p>
            </div>
          </section>
        </>
      )}

      {/* Requirement 2 - Route Stop Detail Panel/Modal */}
      {selectedStop && (
        <RouteStopModal
          row={selectedStop}
          reason={reasonFor(selectedStop)}
          onClose={() => setSelectedStop(null)}
        />
      )}

      {/* Requirement 5 - Review Route Modal */}
      {reviewOpen && (
        <RouteReviewModal
          stops={stops}
          status={routeStatus}
          onClose={() => setReviewOpen(false)}
          onApprove={() => {
            approve()
            setReviewOpen(false)
          }}
        />
      )}
    </section>
  )
}

function RouteKpiCard({ icon, label, value, badge, variant = 'default' }) {
  return (
    <div className={`route-kpi-card ${variant}`}>
      <div className="route-kpi-top">
        <span className="route-kpi-icon">{icon}</span>
        {badge && <span className="route-kpi-badge">{badge}</span>}
      </div>
      <div className="route-kpi-number">{value}</div>
      <div className="route-kpi-title">{label}</div>
    </div>
  )
}

function RouteStopModal({ row, reason, onClose }) {
  return (
    <div className="priority-modal-backdrop" onClick={onClose}>
      <div className="priority-modal route-stop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <span className="section-label">Route Stop Inspection</span>
            <h2>{row.bin_id}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>

        <div className="priority-detail-grid">
          <div>
            <span>Bin ID</span>
            <strong>{row.bin_id}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{row.location}</strong>
          </div>
          <div>
            <span>Current Fill</span>
            <strong>{row.current_fill_level.toFixed(1)}% full</strong>
          </div>
          <div>
            <span>Fill Rate</span>
            <strong>{row.fill_rate.toFixed(2)}% / hour</strong>
          </div>
          <div>
            <span>Predicted Risk</span>
            <strong className={row.predicted_risk === 'High Risk' ? 'text-danger' : 'text-warning'}>
              {row.predicted_risk}
            </strong>
          </div>
          <div>
            <span>Priority</span>
            <strong>{row.priority}</strong>
          </div>
          <div>
            <span>Estimated Overflow</span>
            <strong>{overflowLabel(row.estimated_overflow_hours)}</strong>
          </div>
          <div>
            <span>Waste Type</span>
            <strong>{row.waste_type}</strong>
          </div>
        </div>

        <div className="modal-reason-box">
          <span className="modal-reason-label">Why this bin was prioritized:</span>
          <p className="modal-reason-text">{reason || row.priority_explanation}</p>
        </div>

        <div className="modal-bottom-actions">
          <button className="primary-button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

function RouteReviewModal({ stops, status, onClose, onApprove }) {
  return (
    <div className="priority-modal-backdrop" onClick={onClose}>
      <div className="priority-modal route-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <span className="section-label">Administrator Pre-Approval Inspection</span>
            <h2>Review Route Recommendation</h2>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>

        <p className="sub-title">
          Recommended stops are generated from the existing collection-priority results. Inspect candidate stops, predicted risks, and fill levels before approving the route.
        </p>

        <div className="review-summary-ribbon">
          <div><span>Total Stops:</span><strong>{stops.length} bins</strong></div>
          <div><span>P1 / P2 Urgent:</span><strong>{stops.filter((s) => ['P1', 'P2'].includes(s.priority)).length}</strong></div>
          <div><span>Peak Fill:</span><strong>{stops.length ? Math.max(...stops.map((s) => s.current_fill_level)).toFixed(1) + '%' : '0%'}</strong></div>
          <div><span>Status:</span><strong className={status === 'Route Approved' ? 'text-success' : 'text-pending'}>{status}</strong></div>
        </div>

        <div className="review-table-container">
          <table className="review-stops-table">
            <thead>
              <tr>
                <th>Stop #</th>
                <th>Bin ID</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Predicted Risk</th>
                <th>Fill Level</th>
                <th>Estimated Overflow</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((row, idx) => (
                <tr key={row.bin_id}>
                  <td>
                    <span className="review-stop-pill">{String(idx + 1).padStart(2, '0')}</span>
                  </td>
                  <td><strong>{row.bin_id}</strong></td>
                  <td>{row.location}</td>
                  <td>
                    <span className="priority-tag small">{row.priority}</span>
                  </td>
                  <td>
                    <span className={`risk-badge small ${row.predicted_risk.toLowerCase().replace(' ', '-')}`}>
                      {row.predicted_risk}
                    </span>
                  </td>
                  <td>
                    <strong>{row.current_fill_level.toFixed(1)}%</strong>
                  </td>
                  <td>{overflowLabel(row.estimated_overflow_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-bottom-actions space-between">
          <button className="secondary-button" onClick={onClose}>Close Inspection</button>
          <button
            className={`primary-button ${status === 'Route Approved' ? 'approved' : ''}`}
            onClick={onApprove}
          >
            {status === 'Route Approved' ? (
              <>
                <CheckCircle2 size={16} /> Route Already Approved
              </>
            ) : (
              <>
                <Check size={16} /> Approve Route
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function CampusRouteSvg({ stops, onSelectStop }) {
  // Spoorthy Engineering College campus zones matching backend prototype coordinates
  const CAMPUS_ZONES = [
    { id: 'Depot', name: 'Central Depot', sub: 'Start / Dispatch', x: 60, y: 310, w: 125, h: 58, isDepot: true },
    { id: 'Library', name: 'Library', sub: 'Academic Resource', x: 195, y: 225, w: 115, h: 58 },
    { id: 'Academic Block A', name: 'Academic Block A', sub: 'Classrooms & Labs', x: 50, y: 135, w: 135, h: 58 },
    { id: 'Academic Block B', name: 'Academic Block B', sub: 'Classrooms & Faculty', x: 210, y: 135, w: 135, h: 58 },
    { id: 'Common Area', name: 'Common Area', sub: 'Student Plaza', x: 380, y: 165, w: 125, h: 58 },
    { id: 'Canteen', name: 'Canteen', sub: 'Food Court', x: 535, y: 250, w: 125, h: 58 },
    { id: 'Hostel Block 1', name: 'Hostel Block 1', sub: 'Student Residence 1', x: 325, y: 45, w: 135, h: 58 },
    { id: 'Hostel Block 2', name: 'Hostel Block 2', sub: 'Student Residence 2', x: 485, y: 45, w: 135, h: 58 },
  ]

  // Map each zone to its bins in the route
  const zoneStopsMap = {}
  stops.forEach((stop, index) => {
    const loc = stop.location
    if (!zoneStopsMap[loc]) zoneStopsMap[loc] = []
    zoneStopsMap[loc].push({ ...stop, stopNum: index + 1 })
  })

  // Centers for route path drawing
  const centers = {
    'Depot': { x: 122, y: 339 },
    'Library': { x: 252, y: 254 },
    'Academic Block A': { x: 117, y: 164 },
    'Academic Block B': { x: 277, y: 164 },
    'Common Area': { x: 442, y: 194 },
    'Hostel Block 2': { x: 552, y: 74 },
    'Hostel Block 1': { x: 392, y: 74 },
    'Canteen': { x: 597, y: 279 },
  }

  // Prototype route visit sequence among unique zones
  const routePathPoints = [
    centers['Depot'],
    centers['Library'],
    centers['Academic Block A'],
    centers['Academic Block B'],
    centers['Common Area'],
    centers['Hostel Block 2'],
    centers['Hostel Block 1'],
    centers['Canteen'],
  ]

  const pathString = routePathPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')

  return (
    <div className="campus-svg-container">
      <svg viewBox="0 0 710 410" className="campus-schematic-svg">
        <defs>
          <linearGradient id="depotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#102b22" />
            <stop offset="100%" stopColor="#194838" />
          </linearGradient>
          <linearGradient id="zoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f4faf3" />
          </linearGradient>
          <filter id="boxShadow" x="-5%" y="-5%" width="115%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#102b22" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Campus Terrain Background */}
        <rect x="0" y="0" width="710" height="410" rx="14" fill="#f4faf4" />

        {/* Decorative campus grid roads / walkways */}
        <line x1="40" y1="200" x2="670" y2="200" stroke="#e1ede1" strokeWidth="20" strokeLinecap="round" />
        <line x1="250" y1="30" x2="250" y2="380" stroke="#e1ede1" strokeWidth="18" strokeLinecap="round" />
        <line x1="510" y1="30" x2="510" y2="380" stroke="#e1ede1" strokeWidth="18" strokeLinecap="round" />

        {/* Route Path connecting locations */}
        <path
          d={pathString}
          fill="none"
          stroke="#0b6b58"
          strokeWidth="3.5"
          strokeDasharray="7 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Campus Buildings */}
        {CAMPUS_ZONES.map((zone) => {
          const zoneStops = zoneStopsMap[zone.id] || []
          const hasStops = zoneStops.length > 0
          const firstStopNum = hasStops ? zoneStops[0].stopNum : null
          const hasHighRisk = zoneStops.some((s) => s.predicted_risk === 'High Risk')

          return (
            <g
              key={zone.id}
              className={`campus-zone-group ${hasStops ? 'has-stops' : ''}`}
              onClick={() => {
                if (hasStops) onSelectStop(zoneStops[0])
              }}
              style={{ cursor: hasStops ? 'pointer' : 'default' }}
            >
              {/* Building Card */}
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.w}
                height={zone.h}
                rx="10"
                fill={zone.isDepot ? 'url(#depotGrad)' : 'url(#zoneGrad)'}
                stroke={zone.isDepot ? '#0b6b58' : hasHighRisk ? '#e05656' : hasStops ? '#8ab7a5' : '#cfe0d2'}
                strokeWidth={hasHighRisk ? 2 : 1.2}
                filter="url(#boxShadow)"
              />

              {/* Building Titles */}
              <text
                x={zone.x + 10}
                y={zone.y + 22}
                fill={zone.isDepot ? '#eefcf4' : '#123c2d'}
                fontSize="11"
                fontWeight="800"
                fontFamily="Inter, sans-serif"
              >
                {zone.name}
              </text>
              <text
                x={zone.x + 10}
                y={zone.y + 38}
                fill={zone.isDepot ? '#b9e9b2' : '#68816d'}
                fontSize="9"
                fontWeight="600"
                fontFamily="Inter, sans-serif"
              >
                {hasStops ? `${zoneStops.length} bin stop${zoneStops.length > 1 ? 's' : ''}` : zone.sub}
              </text>

              {/* Stop Sequence Marker on building */}
              {hasStops && (
                <g transform={`translate(${zone.x + zone.w - 14}, ${zone.y + 12})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="11"
                    fill={hasHighRisk ? '#e05656' : '#0b6b58'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="3.5"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                  >
                    {firstStopNum}
                  </text>
                </g>
              )}

              {/* Depot badge */}
              {zone.isDepot && (
                <g transform={`translate(${zone.x + zone.w - 14}, ${zone.y + 12})`}>
                  <circle cx="0" cy="0" r="10" fill="#2bd48d" stroke="#ffffff" strokeWidth="2" />
                  <text x="0" y="3.5" fill="#102b22" fontSize="9" fontWeight="900" textAnchor="middle">
                    0
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const ASSISTANT_EXAMPLE_CHIPS = [
  'Which bins need immediate collection?',
  'How many bins are high risk?',
  'Why is HB1-02 high risk?',
  'Which location needs attention?',
  'How should plastic waste be handled?',
  'How should e-waste be handled?',
]

function FormattedAssistantText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="formatted-assistant-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="msg-spacer" />
        }
        if (trimmed.startsWith('### ')) {
          return <h4 key={idx} className="msg-heading">{trimmed.replace(/^###\s+/, '')}</h4>
        }
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
          return <p key={idx} className="msg-lead"><strong>{trimmed.slice(2, -2)}</strong></p>
        }
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')
        const bulletText = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : trimmed

        const renderInline = (str) => {
          const parts = str.split(/(\*\*.*?\*\*|\*.*?\*)/g)
          return parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx}>{part.slice(1, -1)}</em>
            }
            return part
          })
        }

        if (isBullet) {
          return (
            <div key={idx} className="msg-bullet-item">
              <span className="bullet-dot">•</span>
              <div className="bullet-content">{renderInline(bulletText)}</div>
            </div>
          )
        }

        return <p key={idx} className="msg-paragraph">{renderInline(trimmed)}</p>
      })}
    </div>
  )
}

function AssistantPage() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "### Welcome to AI Waste Assistant\nConfigured for **Spoorthy Engineering College**.\n\nI can assist you with:\n• **Current Telemetry & Urgent Bins:** Real-time fill levels and bins closest to overflow\n• **ML Risk Prediction:** High/medium/low overflow risk classifications based on sensor trends\n• **Collection Prioritization:** Transparent P1-P4 priority scoring engine recommendations\n• **Campus Waste Protocols:** Grounded RAG handling guidelines from our campus knowledge base\n\nClick any suggested question below or type your question to begin.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = async (questionToSend) => {
    const query = (questionToSend || input).trim()
    if (!query || loading) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const historyPayload = nextMessages.map((m) => ({
        role: m.role,
        text: m.text,
      }))

      const response = await fetch(`${API}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          history: historyPayload,
        }),
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      const payload = await response.json()
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: payload.answer || 'No response generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Unable to retrieve current bin information. Please ensure the backend server is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: "### Chat Reset\nHow can I help you with campus waste management or bin telemetry today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  return (
    <section className="page-section assistant-page-section">
      <div className="section-title-row">
        <div>
          <span className="section-label">AI Waste Assistant</span>
          <h2>AI Waste Assistant</h2>
          <div className="sub-title">Ask questions about campus waste telemetry, ML overflow risk, and collection priorities.</div>
        </div>
        <button
          type="button"
          className="secondary-button small-button reset-chat-btn"
          onClick={handleClear}
          title="Start a fresh conversation"
        >
          <RefreshCw size={13} style={{ marginRight: '6px' }} /> Clear Chat
        </button>
      </div>

      <div className="assistant-container">
        {/* Suggested Example Questions */}
        <div className="assistant-suggestions-bar">
          <span className="suggestions-label">Example Questions:</span>
          <div className="example-chips-grid">
            {ASSISTANT_EXAMPLE_CHIPS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="example-chip"
                onClick={() => handleSend(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History Stream */}
        <div className="assistant-chat-stream">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-bubble-wrapper ${msg.role === 'user' ? 'user-wrapper' : 'assistant-wrapper'}`}
            >
              <div className={`chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>
                <div className="bubble-header">
                  <span className={msg.role === 'user' ? 'user-label' : 'assistant-label'}>
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </span>
                  {msg.timestamp && <span className="bubble-timestamp">{msg.timestamp}</span>}
                </div>
                {msg.role === 'user' ? (
                  <div className="user-message-text">{msg.text}</div>
                ) : (
                  <FormattedAssistantText text={msg.text} />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble-wrapper assistant-wrapper">
              <div className="chat-bubble assistant-bubble loading-bubble">
                <div className="bubble-header">
                  <span className="assistant-label">AI Assistant</span>
                </div>
                <div className="loading-dots">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="loading-text">Analyzing telemetry and retrieving guidance...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-input-row">
          <input
            type="text"
            value={input}
            placeholder="Ask about campus waste, bin risk, or collection priorities... (Press Enter to send)"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            disabled={loading}
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </div>
      </div>
    </section>
  )
}

function ReportsPage({
  dashboard,
  bins = [],
  priority = [],
  locationData = [],
  trendData = [],
  riskData = {},
  kpis = {},
  selectedCampus = ACTIVE_CAMPUS,
}) {
  const [locationFilter, setLocationFilter] = useState('All Locations')
  const [riskFilter, setRiskFilter] = useState('All Risk Levels')
  const [wasteFilter, setWasteFilter] = useState('All Waste Types')
  const [dateRange, setDateRange] = useState('Today')
  const [selectedCampusState, setSelectedCampusState] = useState(selectedCampus || ACTIVE_CAMPUS)

  // Map priority data by bin_id for enriched telemetry
  const priorityMap = new Map((priority || []).map((p) => [p.bin_id, p]))

  const enrichedBins = (bins || []).map((b) => {
    const p = priorityMap.get(b.bin_id) || {}
    return {
      ...b,
      priority: p.priority || b.priority || 'P4',
      priority_score: p.priority_score ?? b.priority_score ?? 0,
      estimated_overflow_hours:
        p.est_overflow_hours ?? p.estimated_overflow_hours ?? b.estimated_overflow_hours ?? null,
    }
  })

  // Filter bins based on selected filter toolbar
  const filteredBins = enrichedBins.filter((b) => {
    if (locationFilter !== 'All Locations' && b.location !== locationFilter) return false
    if (riskFilter !== 'All Risk Levels' && b.predicted_risk !== riskFilter) return false
    if (wasteFilter !== 'All Waste Types') {
      const wClean =
        b.waste_type === 'Organic'
          ? 'Food / Organic'
          : b.waste_type === 'Mixed'
          ? 'Mixed Waste'
          : b.waste_type
      if (wClean !== wasteFilter && b.waste_type !== wasteFilter) return false
    }
    return true
  })

  // Executive KPI calculations (strictly from filtered real telemetry)
  const totalBins = filteredBins.length
  const highRiskCount = filteredBins.filter((b) => b.predicted_risk === 'High Risk').length
  const medRiskCount = filteredBins.filter((b) => b.predicted_risk === 'Medium Risk').length
  const lowRiskCount = filteredBins.filter((b) => b.predicted_risk === 'Low Risk').length
  const avgFill =
    totalBins > 0
      ? filteredBins.reduce((sum, b) => sum + (b.current_fill_level || 0), 0) / totalBins
      : 0
  const maxFill =
    totalBins > 0 ? Math.max(...filteredBins.map((b) => b.current_fill_level || 0)) : 0

  const p1Count = filteredBins.filter((b) => b.priority === 'P1').length
  const p2Count = filteredBins.filter((b) => b.priority === 'P2').length
  const p3Count = filteredBins.filter((b) => b.priority === 'P3').length
  const p4Count = filteredBins.filter((b) => b.priority === 'P4').length
  const immediateBins = filteredBins.filter(
    (b) =>
      b.priority === 'P1' ||
      (b.estimated_overflow_hours !== null && b.estimated_overflow_hours <= 1.0) ||
      b.current_fill_level >= 98
  ).length
  const collectionsRequired = p1Count + p2Count

  // Waste Type Distribution Data for Charts
  const wasteCounts = filteredBins.reduce((acc, b) => {
    const w =
      b.waste_type === 'Organic'
        ? 'Food / Organic'
        : b.waste_type === 'Mixed'
        ? 'Mixed Waste'
        : b.waste_type
    acc[w] = (acc[w] || 0) + 1
    return acc
  }, {})
  const wasteChartData = Object.entries(wasteCounts).map(([name, count]) => ({
    name,
    count,
  }))
  const sortedWaste = [...wasteChartData].sort((a, b) => b.count - a.count)
  const dominantWaste = sortedWaste[0]?.name || 'Mixed Waste'
  const dominantWastePct =
    totalBins > 0 ? (((sortedWaste[0]?.count || 0) / totalBins) * 100).toFixed(0) : '0'

  // Location Aggregation Data for Charts & Insights
  const locationAgg = filteredBins.reduce((acc, b) => {
    if (!acc[b.location]) {
      acc[b.location] = { location: b.location, total: 0, fillSum: 0, highRisk: 0 }
    }
    acc[b.location].total += 1
    acc[b.location].fillSum += b.current_fill_level || 0
    if (b.predicted_risk === 'High Risk') acc[b.location].highRisk += 1
    return acc
  }, {})
  const locationChartData = Object.values(locationAgg)
    .map((loc) => ({
      location: loc.location,
      avgFill: Number((loc.fillSum / (loc.total || 1)).toFixed(1)),
      highRisk: loc.highRisk,
      total: loc.total,
    }))
    .sort((a, b) => b.avgFill - a.avgFill)

  const topLocation = locationChartData[0]?.location || 'Canteen'
  const topLocAvg = locationChartData[0]?.avgFill || 0
  const topLocHighRisk = locationChartData[0]?.highRisk || 0

  // Risk Distribution Data for Pie Chart
  const riskChartData = [
    { name: 'High Risk', value: highRiskCount, color: '#e05656' },
    { name: 'Medium Risk', value: medRiskCount, color: '#d97706' },
    { name: 'Low Risk', value: lowRiskCount, color: '#0b6b58' },
  ].filter((r) => r.value > 0)

  // Priority Distribution Data for Bar Chart
  const priorityChartData = [
    { name: 'P1 - Immediate', count: p1Count, color: '#dc2626' },
    { name: 'P2 - High Priority', count: p2Count, color: '#ea580c' },
    { name: 'P3 - Medium', count: p3Count, color: '#d97706' },
    { name: 'P4 - Routine', count: p4Count, color: '#0b6b58' },
  ]

  // CSV Report Downloader
  const downloadReportCSV = (reportType) => {
    const header =
      'Bin ID,Location,Waste Type,Current Fill (%),Fill Rate (%/hr),Historical Avg (%),Predicted Risk,Priority,Priority Score,Est Overflow (Hours)\n'
    const rows = filteredBins
      .map((b) =>
        [
          b.bin_id,
          b.location,
          b.waste_type,
          (b.current_fill_level ?? 0).toFixed(1),
          (b.fill_rate ?? 0).toFixed(2),
          (b.historical_average_fill ?? 0).toFixed(1),
          b.predicted_risk,
          b.priority,
          (b.priority_score ?? 0).toFixed(1),
          b.estimated_overflow_hours !== null && isFinite(b.estimated_overflow_hours)
            ? b.estimated_overflow_hours.toFixed(1)
            : 'N/A',
        ]
          .map((val) => `"${String(val).replaceAll('"', '""')}"`)
          .join(',')
      )
      .join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spoorthy-${reportType}-waste-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Professional Printable PDF Generator
  const downloadReportPDF = (reportType) => {
    const printWindow = window.open('', '_blank', 'width=900,height=750')
    if (!printWindow) {
      alert('Please allow browser popups to generate and view the printable PDF report.')
      return
    }
    const reportTitle =
      reportType === 'daily'
        ? 'DAILY OPERATIONAL WASTE REPORT'
        : reportType === 'weekly'
        ? 'WEEKLY COLLECTION DEMAND REPORT'
        : 'MONTHLY STRATEGIC WASTE SUMMARY'
    const reportSubtitle =
      reportType === 'daily'
        ? 'Current Operational Shift Snapshot'
        : reportType === 'weekly'
        ? 'Collection Demand & Urgency Forecast'
        : 'Strategic Campus Capacity & Risk Overview'
    const operationalNote =
      reportType === 'daily'
        ? 'Daily metrics reflecting current live telemetry.'
        : reportType === 'weekly'
        ? 'Collection requirement based on current simulated telemetry.'
        : 'Monthly summary based on available simulated sensor data.'

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} - ${selectedCampusState}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1f2937; background: #fff; margin: 0; }
    .header-bar { border-bottom: 3px solid #0b6b58; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand h1 { color: #0b6b58; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .brand h2 { color: #111827; margin: 4px 0 0; font-size: 15px; font-weight: 700; text-transform: uppercase; }
    .meta-box { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.5; }
    .filter-summary { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #065f46; display: flex; gap: 20px; flex-wrap: wrap; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 12px; text-align: center; }
    .kpi-card .val { font-size: 22px; font-weight: 800; color: #0b6b58; margin-bottom: 4px; }
    .kpi-card .lbl { font-size: 11px; font-weight: 600; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-head { font-size: 14px; font-weight: 700; color: #111827; margin: 24px 0 10px; border-left: 4px solid #0b6b58; padding-left: 10px; text-transform: uppercase; }
    .insights-box { background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 12px; line-height: 1.6; color: #854d0e; }
    .insights-box ul { margin: 0; padding-left: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #0b6b58; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 600; font-size: 11px; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; color: #374151; }
    tr:nth-child(even) td { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10px; }
    .badge-high { background: #fee2e2; color: #991b1b; }
    .badge-med { background: #fef3c7; color: #92400e; }
    .badge-low { background: #dcfce7; color: #166534; }
    .badge-p1 { background: #fef2f2; color: #b91c1c; border: 1px solid #fca5a5; }
    .disclaimer-box { margin-top: 32px; padding: 14px 18px; background: #f9fafb; border: 1px dashed #d1d5db; border-radius: 8px; font-size: 11px; color: #4b5563; line-height: 1.5; }
    @media print { body { padding: 12px; } .disclaimer-box { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">
      <h1>${selectedCampusState}</h1>
      <h2>${reportTitle}</h2>
      <div style="font-size: 12px; color: #4b5563; margin-top: 2px;">${reportSubtitle}</div>
    </div>
    <div class="meta-box">
      <div><strong>Report ID:</strong> RPT-${Date.now().toString().slice(-6)}</div>
      <div><strong>Date:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div><strong>System:</strong> Campus Waste Intelligence</div>
    </div>
  </div>

  <div class="filter-summary">
    <div><strong>Scope:</strong> ${selectedCampusState}</div>
    <div><strong>Location:</strong> ${locationFilter}</div>
    <div><strong>Risk Filter:</strong> ${riskFilter}</div>
    <div><strong>Waste Type:</strong> ${wasteFilter}</div>
    <div><strong>Horizon:</strong> ${dateRange}</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="val">${totalBins}</div>
      <div class="lbl">Total Bins Monitored</div>
    </div>
    <div class="kpi-card">
      <div class="val" style="color: #dc2626;">${highRiskCount}</div>
      <div class="lbl">High-Risk Bins (${totalBins > 0 ? ((highRiskCount / totalBins) * 100).toFixed(0) : 0}%)</div>
    </div>
    <div class="kpi-card">
      <div class="val">${avgFill.toFixed(1)}%</div>
      <div class="lbl">Average Fill Level</div>
    </div>
    <div class="kpi-card">
      <div class="val" style="color: #ea580c;">${p1Count} P1 / ${p2Count} P2</div>
      <div class="lbl">Priority Collection Load</div>
    </div>
  </div>

  <div class="section-head">Operational Intelligence Summary</div>
  <div class="insights-box">
    <ul>
      <li><strong>Risk Analysis:</strong> <strong>${highRiskCount} of ${totalBins} bins (${totalBins > 0 ? ((highRiskCount / totalBins) * 100).toFixed(0) : 0}%)</strong> currently operate under High Risk according to ML Decision Tree classification.</li>
      <li><strong>Immediate Urgent Dispatch:</strong> <strong>${p1Count} bins</strong> require immediate collection (P1) to prevent imminent overflow hazard.</li>
      <li><strong>Peak Attention Zone:</strong> <strong>${topLocation}</strong> exhibits peak concentration with average fill of <strong>${topLocAvg.toFixed(1)}%</strong> and <strong>${topLocHighRisk} high-risk bins</strong>.</li>
      <li><strong>Waste Composition:</strong> <strong>${dominantWaste}</strong> forms the primary waste category (${dominantWastePct}% of filtered volume).</li>
    </ul>
  </div>

  <div class="section-head">Critical Bin Inventory & Urgency Dispatch Schedule</div>
  <table>
    <thead>
      <tr>
        <th>Bin ID</th>
        <th>Location</th>
        <th>Waste Stream</th>
        <th>Current Fill</th>
        <th>Fill Rate</th>
        <th>Risk Level</th>
        <th>Priority</th>
        <th>Est Overflow</th>
      </tr>
    </thead>
    <tbody>
      ${filteredBins.slice(0, 20).map((b) => `
        <tr>
          <td><strong>${b.bin_id}</strong></td>
          <td>${b.location}</td>
          <td>${b.waste_type}</td>
          <td><strong>${(b.current_fill_level || 0).toFixed(1)}%</strong></td>
          <td>${(b.fill_rate || 0).toFixed(2)}%/hr</td>
          <td><span class="badge ${b.predicted_risk === 'High Risk' ? 'badge-high' : b.predicted_risk === 'Medium Risk' ? 'badge-med' : 'badge-low'}">${b.predicted_risk}</span></td>
          <td><span class="badge ${b.priority === 'P1' ? 'badge-p1' : ''}">${b.priority || 'P4'}</span></td>
          <td>${b.estimated_overflow_hours !== null && isFinite(b.estimated_overflow_hours) ? `${b.estimated_overflow_hours.toFixed(1)} hours` : 'Not imminent'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="disclaimer-box">
    <div><strong>Operational Status:</strong> ${operationalNote}</div>
    <div><strong>Data Source:</strong> Simulated campus waste sensor dataset used for prototype demonstration.</div>
    <div style="margin-top: 4px;"><strong>Responsible AI Advisory:</strong> All predictions, risk levels, and collection priorities are AI-assisted recommendations based on sensor readings and must be reviewed by authorized campus sanitation supervisors before physical vehicle dispatch.</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const resetFilters = () => {
    setLocationFilter('All Locations')
    setRiskFilter('All Risk Levels')
    setWasteFilter('All Waste Types')
    setDateRange('Today')
  }

  return (
    <section className="page-section reports-page-section">
      {/* Header Row */}
      <div className="section-title-row">
        <div>
          <span className="section-label">Executive Analytics & Compliance</span>
          <h2>Campus Waste Intelligence Reports</h2>
        </div>
        <div className="reports-header-badge">
          <Building2 size={16} />
          <span>{selectedCampusState}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="reports-filter-bar">
        <div className="reports-filter-group">
          <label>
            <Building2 size={13} /> Campus
          </label>
          <select
            value={selectedCampusState}
            onChange={(e) => setSelectedCampusState(e.target.value)}
          >
            {CAMPUS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="reports-filter-group">
          <label>
            <MapPin size={13} /> Location
          </label>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            {LOCATION_OPTIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="reports-filter-group">
          <label>
            <AlertTriangle size={13} /> Risk Level
          </label>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            {RISK_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="reports-filter-group">
          <label>
            <Trash2 size={13} /> Waste Type
          </label>
          <select
            value={wasteFilter}
            onChange={(e) => setWasteFilter(e.target.value)}
          >
            {WASTE_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div className="reports-filter-group">
          <label>
            <CalendarDays size={13} /> Time Horizon
          </label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="Today">Today (Current Telemetry)</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="All Data">All Simulated Records</option>
          </select>
        </div>

        <button
          className="secondary-button small-button reports-reset-btn"
          onClick={resetFilters}
          title="Reset all filters"
        >
          <RefreshCw size={13} /> Reset
        </button>
      </div>

      {/* 1. Executive Summary KPI Section */}
      <div className="reports-kpi-grid">
        <div className="reports-kpi-card">
          <div className="reports-kpi-icon-wrap icon-teal">
            <Trash2 size={20} />
          </div>
          <div className="reports-kpi-body">
            <span className="reports-kpi-label">Total Bins Monitored</span>
            <div className="reports-kpi-value">{totalBins}</div>
            <span className="reports-kpi-sub">
              Active physical bins in scope
            </span>
          </div>
        </div>

        <div className="reports-kpi-card">
          <div className="reports-kpi-icon-wrap icon-red">
            <AlertTriangle size={20} />
          </div>
          <div className="reports-kpi-body">
            <span className="reports-kpi-label">High-Risk Bins</span>
            <div className="reports-kpi-value text-red">{highRiskCount}</div>
            <span className="reports-kpi-sub">
              {totalBins > 0 ? ((highRiskCount / totalBins) * 100).toFixed(0) : 0}% of scope requiring urgent clearance
            </span>
          </div>
        </div>

        <div className="reports-kpi-card">
          <div className="reports-kpi-icon-wrap icon-amber">
            <ClipboardCheck size={20} />
          </div>
          <div className="reports-kpi-body">
            <span className="reports-kpi-label">Collections Required</span>
            <div className="reports-kpi-value">{collectionsRequired}</div>
            <span className="reports-kpi-sub">
              P1 & P2 priority collection load
            </span>
          </div>
        </div>

        <div className="reports-kpi-card">
          <div className="reports-kpi-icon-wrap icon-green">
            <LineChart size={20} />
          </div>
          <div className="reports-kpi-body">
            <span className="reports-kpi-label">Average Fill Level</span>
            <div className="reports-kpi-value">{avgFill.toFixed(1)}%</div>
            <span className="reports-kpi-sub">
              Peak recorded fill: {maxFill.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="reports-kpi-card">
          <div className="reports-kpi-icon-wrap icon-red">
            <Clock size={20} />
          </div>
          <div className="reports-kpi-body">
            <span className="reports-kpi-label">Overflow / Immediate</span>
            <div className="reports-kpi-value text-red">{immediateBins}</div>
            <span className="reports-kpi-sub">
              Full or est. overflow &lt; 1.0 hr
            </span>
          </div>
        </div>

        <div className="reports-kpi-card">
          <div className="reports-kpi-icon-wrap icon-teal">
            <ShieldCheck size={20} />
          </div>
          <div className="reports-kpi-body">
            <span className="reports-kpi-label">Priority Tiers</span>
            <div className="reports-kpi-value">
              {p1Count} <span className="reports-tier-sub">P1</span> / {p2Count} <span className="reports-tier-sub">P2</span>
            </div>
            <span className="reports-kpi-sub">
              P3: {p3Count} | P4: {p4Count}
            </span>
          </div>
        </div>
      </div>

      {/* Key Management Insights Section */}
      <div className="reports-insights-card">
        <div className="reports-insights-head">
          <TrendingUp size={18} />
          <h3>Key Waste Management Insights</h3>
        </div>
        <div className="reports-insights-grid">
          <div className="reports-insight-item">
            <span className="insight-bullet"></span>
            <div>
              <strong>Risk Concentration:</strong>{' '}
              {highRiskCount} of {totalBins} monitored bins ({totalBins > 0 ? ((highRiskCount / totalBins) * 100).toFixed(0) : 0}%) are currently classified as High Risk by Decision Tree ML analysis.
            </div>
          </div>
          <div className="reports-insight-item">
            <span className="insight-bullet"></span>
            <div>
              <strong>Critical Campus Zone:</strong>{' '}
              <strong>{topLocation}</strong> exhibits the highest capacity utilization (average {topLocAvg.toFixed(1)}%), representing the primary priority for vehicle dispatch.
            </div>
          </div>
          <div className="reports-insight-item">
            <span className="insight-bullet"></span>
            <div>
              <strong>Overflow Prevention:</strong>{' '}
              {immediateBins} bins require intervention within the hour or are currently at 100% capacity.
            </div>
          </div>
          <div className="reports-insight-item">
            <span className="insight-bullet"></span>
            <div>
              <strong>Dominant Stream:</strong>{' '}
              <strong>{dominantWaste}</strong> accounts for {dominantWastePct}% of monitored waste bins in the active filter selection.
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Periodic Reports Grid (Daily, Weekly, Monthly) */}
      <div className="reports-period-grid">
        {/* Daily Waste Report */}
        <div className="reports-period-card card-daily">
          <div className="period-card-head">
            <div>
              <span className="period-pill pill-daily">Daily Operations</span>
              <h4>Daily Waste Report</h4>
              <p className="period-desc">Current shift status and real-time telemetry snapshot</p>
            </div>
            <FileText className="period-watermark-icon" size={32} />
          </div>

          <div className="period-stats-table">
            <div className="period-stat-row">
              <span>Monitored Bins</span>
              <strong>{totalBins}</strong>
            </div>
            <div className="period-stat-row">
              <span>Risk Breakdown</span>
              <span>
                <strong className="text-red">{highRiskCount} High</strong> •{' '}
                <strong className="text-amber">{medRiskCount} Med</strong> •{' '}
                <strong className="text-green">{lowRiskCount} Low</strong>
              </span>
            </div>
            <div className="period-stat-row">
              <span>Immediate Collections</span>
              <strong className="text-red">{p1Count} Bins</strong>
            </div>
            <div className="period-stat-row">
              <span>Average Fill Level</span>
              <strong>{avgFill.toFixed(1)}% (Max {maxFill.toFixed(1)}%)</strong>
            </div>
          </div>

          <div className="period-action-row">
            <button
              className="secondary-button small-button"
              onClick={() => downloadReportCSV('daily')}
            >
              <Download size={14} /> Download CSV
            </button>
            <button
              className="primary-button small-button"
              onClick={() => downloadReportPDF('daily')}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>

        {/* Weekly Waste Report */}
        <div className="reports-period-card card-weekly">
          <div className="period-card-head">
            <div>
              <span className="period-pill pill-weekly">Weekly Planning</span>
              <h4>Weekly Waste Report</h4>
              <p className="period-desc">Aggregated demand forecast and collection logistics</p>
            </div>
            <CalendarDays className="period-watermark-icon" size={32} />
          </div>

          <div className="period-stats-table">
            <div className="period-stat-row">
              <span>Collections Required</span>
              <strong>{collectionsRequired} Bins</strong>
            </div>
            <div className="period-stat-row">
              <span>Priority Allocation</span>
              <span>
                <strong>{p1Count} P1</strong> • <strong>{p2Count} P2</strong> • {p3Count} P3
              </span>
            </div>
            <div className="period-stat-row">
              <span>Top Attention Area</span>
              <strong>{topLocation} ({topLocAvg.toFixed(1)}%)</strong>
            </div>
            <div className="period-stat-row">
              <span>Imminent Overflow</span>
              <strong className="text-amber">{immediateBins} Points</strong>
            </div>
          </div>

          <div className="period-sim-note">
            Collection requirement based on current simulated telemetry
          </div>

          <div className="period-action-row">
            <button
              className="secondary-button small-button"
              onClick={() => downloadReportCSV('weekly')}
            >
              <Download size={14} /> Download CSV
            </button>
            <button
              className="primary-button small-button"
              onClick={() => downloadReportPDF('weekly')}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>

        {/* Monthly Waste Report */}
        <div className="reports-period-card card-monthly">
          <div className="period-card-head">
            <div>
              <span className="period-pill pill-monthly">Monthly Strategic</span>
              <h4>Monthly Waste Report</h4>
              <p className="period-desc">Strategic infrastructure capacity & source overview</p>
            </div>
            <Layers className="period-watermark-icon" size={32} />
          </div>

          <div className="period-stats-table">
            <div className="period-stat-row">
              <span>Average Fill Level</span>
              <strong>{avgFill.toFixed(1)}%</strong>
            </div>
            <div className="period-stat-row">
              <span>High Risk Proportion</span>
              <strong className="text-red">
                {totalBins > 0 ? ((highRiskCount / totalBins) * 100).toFixed(1) : 0}%
              </strong>
            </div>
            <div className="period-stat-row">
              <span>Dominant Waste Stream</span>
              <strong>{dominantWaste} ({dominantWastePct}%)</strong>
            </div>
            <div className="period-stat-row">
              <span>Highest Risk Location</span>
              <strong>{topLocation} ({topLocHighRisk} high-risk)</strong>
            </div>
          </div>

          <div className="period-sim-note">
            Monthly summary based on available simulated sensor data.
          </div>

          <div className="period-action-row">
            <button
              className="secondary-button small-button"
              onClick={() => downloadReportCSV('monthly')}
            >
              <Download size={14} /> Download CSV
            </button>
            <button
              className="primary-button small-button"
              onClick={() => downloadReportPDF('monthly')}
            >
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>

      {/* 4. Visual Analytics Section */}
      <div className="reports-section-title-row">
        <div>
          <span className="section-label">Visual Telemetry Breakdown</span>
          <h3>Interactive Report Analytics</h3>
        </div>
      </div>

      <div className="reports-charts-grid">
        {/* Risk Distribution */}
        <div className="reports-chart-card">
          <div className="chart-head">
            <div>
              <h4>Risk Classification Distribution</h4>
              <p>Proportion of bins categorized by ML risk engine</p>
            </div>
          </div>
          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={riskChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {riskChartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Waste Type Breakdown */}
        <div className="reports-chart-card">
          <div className="chart-head">
            <div>
              <h4>Waste Stream Distribution</h4>
              <p>Number of bins monitored per waste type</p>
            </div>
          </div>
          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={wasteChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#4b5563' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0b6b58" radius={[4, 4, 0, 0]} name="Bins Monitored" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Location Risk & Fill Overview */}
        <div className="reports-chart-card">
          <div className="chart-head">
            <div>
              <h4>Location Capacity & High-Risk Overview</h4>
              <p>Average fill % and count of high-risk bins per zone</p>
            </div>
          </div>
          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={locationChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="location" angle={-15} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#4b5563' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip />
                <Bar dataKey="avgFill" fill="#0b6b58" radius={[4, 4, 0, 0]} name="Avg Fill (%)" />
                <Bar dataKey="highRisk" fill="#e05656" radius={[4, 4, 0, 0]} name="High-Risk Bins" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Collection Priority Tiers */}
        <div className="reports-chart-card">
          <div className="chart-head">
            <div>
              <h4>Collection Priority Distribution</h4>
              <p>Bins categorized by P1–P4 collection urgency scoring</p>
            </div>
          </div>
          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={priorityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4b5563' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Bins">
                  {priorityChartData.map((entry, idx) => (
                    <Cell key={`pcell-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Responsible AI Note Banner */}
      <div className="reports-responsible-ai-banner">
        <ShieldCheck size={24} className="banner-shield-icon" />
        <div>
          <strong>Data Source:</strong> Simulated campus waste sensor dataset used for prototype demonstration.
          <p>
            Predictions and collection priorities are AI-assisted recommendations based on simulated data and should be reviewed by authorized campus personnel before operational action.
          </p>
        </div>
      </div>
    </section>
  )
}

function SettingsPage({
  riskThreshold = 70,
  onRiskThresholdChange,
  notificationPrefs = {
    emailAlerts: true,
    highRiskAlerts: true,
    overflowAlerts: true,
    priorityAlerts: true,
  },
  onNotificationPrefsChange,
  selectedCampus = 'Spoorthy Engineering College',
}) {
  const [saveToast, setSaveToast] = useState(false)

  const handleToggle = (key) => {
    onNotificationPrefsChange((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
    showSavedFeedback()
  }

  const handleThresholdChange = (e) => {
    const val = Number(e.target.value)
    onRiskThresholdChange(val)
    showSavedFeedback()
  }

  const showSavedFeedback = () => {
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 2400)
  }

  return (
    <section className="page-section settings-module-view">
      <div className="section-title-row settings-header-row">
        <div>
          <span className="section-label">Preferences & Governance</span>
          <h2>System Settings & AI Controls</h2>
          <p className="sub-title">
            Configure telemetry risk thresholds, operational alert preferences, and review Responsible AI governance policies.
          </p>
        </div>
        {saveToast && (
          <div className="settings-saved-toast">
            <CheckCircle2 size={16} /> Preferences updated & saved
          </div>
        )}
      </div>

      <div className="settings-cards-grid">
        {/* Card 1: System Settings */}
        <div className="settings-card system-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Sliders size={20} />
            </div>
            <div>
              <h3>System Settings</h3>
              <p className="card-sub-desc">Core ML threshold and operational deployment status</p>
            </div>
          </div>

          <div className="settings-card-content">
            {/* AI System Status */}
            <div className="settings-row status-highlight-row">
              <div className="settings-row-label">
                <span className="setting-title">AI System Status</span>
                <span className="setting-desc">Status of the ML Risk Classifier and Collection Priority Engine</span>
              </div>
              <div className="system-status-indicator online">
                <span className="status-indicator-dot pulse"></span>
                <span className="status-indicator-text">Online & Operational</span>
              </div>
            </div>

            {/* Risk Threshold Slider */}
            <div className="settings-row threshold-row">
              <div className="threshold-head">
                <div className="settings-row-label">
                  <span className="setting-title">Risk Threshold</span>
                  <span className="setting-desc">
                    Threshold percentage for classifying bins into High-Risk tier and triggering priority dispatches.
                  </span>
                </div>
                <div className="threshold-badge-wrap">
                  <span className="threshold-val-badge">{riskThreshold}%</span>
                </div>
              </div>

              <div className="threshold-slider-container">
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={riskThreshold}
                  onChange={handleThresholdChange}
                  className="settings-range-slider"
                  aria-label="Risk Threshold Percentage"
                />
                <div className="threshold-scale-marks">
                  <span>50% (Strict)</span>
                  <span>70% (Standard)</span>
                  <span>85%</span>
                  <span>100% (Lenient)</span>
                </div>
              </div>

              <div className="threshold-explanation">
                <Info size={14} className="info-icon" />
                <span>
                  Bins with fill level &ge; <strong>{riskThreshold}%</strong> or predicted high fill-velocity will trigger priority alerts and be marked for immediate dispatch.
                </span>
              </div>
            </div>

            {/* Active Campus Display */}
            <div className="settings-row campus-display-row">
              <div className="settings-row-label">
                <span className="setting-title">Active Campus Deployment</span>
                <span className="setting-desc">Target campus facility currently receiving simulated telemetry monitoring</span>
              </div>
              <div className="campus-badge-group">
                <div className="active-campus-pill">
                  <Building2 size={14} />
                  <strong>{selectedCampus}</strong>
                  <span className="prototype-badge">Active Prototype</span>
                </div>
                <div className="future-campuses-hint">
                  <span>Other campus locations: <em className="coming-soon-label">Coming Soon in v2.0</em></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Notification Settings */}
        <div className="settings-card notification-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Bell size={20} />
            </div>
            <div>
              <h3>Notification Settings</h3>
              <p className="card-sub-desc">Real-time alerts for critical capacity, overflow risk, and collections</p>
            </div>
          </div>

          <div className="settings-card-content">
            {/* Email Alerts Toggle */}
            <div className="settings-toggle-row">
              <div className="settings-toggle-label">
                <div className="toggle-title-row">
                  <Mail size={16} className="toggle-icon" />
                  <span className="setting-title">Email Alerts</span>
                </div>
                <span className="setting-desc">
                  Deliver periodic digests and high-urgency notifications to operational campus facilities email.
                </span>
                <div className="email-disclaimer-note">
                  <AlertTriangle size={13} />
                  <span>
                    Email delivery requires notification service configuration. Currently operating in local in-app alert mode.
                  </span>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationPrefs.emailAlerts}
                  onChange={() => handleToggle('emailAlerts')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* High-Risk Bin Alerts */}
            <div className="settings-toggle-row">
              <div className="settings-toggle-label">
                <div className="toggle-title-row">
                  <AlertTriangle size={16} className="toggle-icon text-amber" />
                  <span className="setting-title">High-Risk Bin Alerts</span>
                </div>
                <span className="setting-desc">
                  Notify when bins reach or exceed the active risk threshold ({riskThreshold}%) or are flagged High Risk by ML.
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationPrefs.highRiskAlerts}
                  onChange={() => handleToggle('highRiskAlerts')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Overflow Alerts */}
            <div className="settings-toggle-row">
              <div className="settings-toggle-label">
                <div className="toggle-title-row">
                  <AlertTriangle size={16} className="toggle-icon text-red" />
                  <span className="setting-title">Critical Overflow Alerts</span>
                </div>
                <span className="setting-desc">
                  Notify when bins reach critical capacity (&ge; 98%) or estimated time to overflow is under 1.0 hour.
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationPrefs.overflowAlerts}
                  onChange={() => handleToggle('overflowAlerts')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {/* Collection Priority Alerts */}
            <div className="settings-toggle-row">
              <div className="settings-toggle-label">
                <div className="toggle-title-row">
                  <ClipboardCheck size={16} className="toggle-icon text-primary" />
                  <span className="setting-title">Collection Priority Alerts</span>
                </div>
                <span className="setting-desc">
                  Notify when bins are queued into P1 (Immediate Dispatch) or P2 (High Priority) collection tiers.
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationPrefs.priorityAlerts}
                  onChange={() => handleToggle('priorityAlerts')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Responsible AI Governance */}
      <div className="settings-card responsible-ai-card">
        <div className="settings-card-header">
          <div className="settings-card-icon-wrap shield-wrap">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3>Responsible AI & Ethical Decision Framework</h3>
            <p className="card-sub-desc">
              Core architectural principles ensuring human-in-the-loop oversight and trustworthy AI operation.
            </p>
          </div>
        </div>

        <div className="responsible-ai-grid">
          <div className="responsible-ai-pillar">
            <div className="pillar-header">
              <span className="pillar-number">01</span>
              <h4>Human Oversight</h4>
            </div>
            <p>
              Campus sanitation staff and facilities managers maintain ultimate operational decision-making authority over all collection routes and schedule execution.
            </p>
          </div>

          <div className="responsible-ai-pillar">
            <div className="pillar-header">
              <span className="pillar-number">02</span>
              <h4>Explainable Prioritization</h4>
            </div>
            <p>
              Every collection recommendation is backed by clear, understandable telemetry factors: fill level, fill rate velocity, waste stream, and zone location.
            </p>
          </div>

          <div className="responsible-ai-pillar">
            <div className="pillar-header">
              <span className="pillar-number">03</span>
              <h4>Transparent Scoring</h4>
            </div>
            <p>
              Open, auditable classification rules and P1–P4 priority thresholds eliminate black-box unpredictability and allow operators to verify AI reasoning.
            </p>
          </div>

          <div className="responsible-ai-pillar">
            <div className="pillar-header">
              <span className="pillar-number">04</span>
              <h4>Data Privacy</h4>
            </div>
            <p>
              The platform operates solely on anonymous bin fill levels and simulated sensor metrics. No personal, student, faculty, or surveillance data is gathered or stored.
            </p>
          </div>

          <div className="responsible-ai-pillar">
            <div className="pillar-header">
              <span className="pillar-number">05</span>
              <h4>No Autonomous Collection Decisions</h4>
            </div>
            <p>
              The system functions strictly as a decision-support advisory tool, preventing unverified automated physical dispatches or unchecked resource allocations.
            </p>
          </div>
        </div>

        {/* Prototype Data Notice */}
        <div className="settings-prototype-notice">
          <Info size={18} className="notice-icon" />
          <div>
            <strong>Prototype Demonstration Notice:</strong>
            <span>
              {' '}Collection predictions and priority classifications are generated using simulated campus waste sensor telemetry. For live operational deployment, physical sensor calibration and site verification should be conducted.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function LoadingSkeleton() {
  return <div className="loading-card">Loading campus data...</div>
}

export default App
