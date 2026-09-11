const USERS_KEY = 'campus_waste_users'

const demoUser = {
  name: 'Campus Admin',
  email: 'admin@campuswaste.ai',
  password: 'Admin@123',
  role: 'Admin',
}

function readUsers() {
  let users = []
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY) || 'null')
    if (Array.isArray(saved)) users = saved
  } catch {
    // Restore the prototype account when stored data is malformed.
  }

  const normalizedUsers = users
    .filter((user) => user && user.email && user.password)
    .map((user) => ({
      ...user,
      name: String(user.name || 'Campus User').trim(),
      email: String(user.email).trim().toLowerCase(),
      role: String(user.role || 'Campus Manager'),
    }))

  if (!normalizedUsers.some((user) => user.email === demoUser.email)) {
    normalizedUsers.unshift(demoUser)
  }

  localStorage.setItem(USERS_KEY, JSON.stringify(normalizedUsers))
  return normalizedUsers
}

export function authenticate(email, password) {
  const validEmail = String(email || '').trim().toLowerCase()
  const validPassword = String(password || '')
  const user = readUsers().find((candidate) => candidate.email === validEmail && String(candidate.password) === validPassword)

  if (!user) return { ok: false, message: 'Invalid email or password.' }

  const { password: ignoredPassword, ...safeUser } = user
  return { ok: true, user: safeUser }
}

export function registerUser({ name, email, password, role }) {
  const validEmail = String(email || '').trim().toLowerCase()
  const users = readUsers()

  if (users.some((user) => user.email === validEmail)) {
    return { ok: false, message: 'An account with this email already exists.' }
  }

  const user = { name: String(name || '').trim(), email: validEmail, password, role }
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]))
  return { ok: true }
}

export function accountExists(email) {
  const validEmail = String(email || '').trim().toLowerCase()
  return readUsers().some((user) => user.email === validEmail)
}

export function protectedPages() {
  return ['dashboard', 'bins', 'priority', 'analytics', 'routes', 'assistant', 'reports', 'settings']
}

export function pageFromPath(pathname) {
  const clean = String(pathname || '/').replace(/^\/+|\/+$/g, '') || 'landing'
  if (clean === 'landing') return 'landing'
  if (clean === 'login') return 'login'
  if (clean === 'register') return 'register'
  if (clean === 'forgot-password') return 'forgot-password'
  if (clean === 'dashboard') return 'dashboard'
  if (clean === 'bins') return 'bins'
  if (clean === 'priority') return 'priority'
  if (clean === 'analytics') return 'analytics'
  if (clean === 'routes') return 'routes'
  if (clean === 'assistant') return 'assistant'
  if (clean === 'reports') return 'reports'
  if (clean === 'settings') return 'settings'
  return 'landing'
}

export function routeForPage(page) {
  return {
    dashboard: '/dashboard',
    bins: '/bins',
    priority: '/priority',
    analytics: '/analytics',
    routes: '/routes',
    assistant: '/assistant',
    reports: '/reports',
    settings: '/settings',
    landing: '/',
    login: '/login',
    register: '/register',
    'forgot-password': '/forgot-password',
  }[page] || '/'
}
