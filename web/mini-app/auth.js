const TOKEN_KEY = 'attendance_token'
const USER_KEY = 'attendance_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function setSession(token, user) {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(USER_KEY, user)

  const app = getApp()
  if (app && typeof app.setUser === 'function') {
    app.setUser(user)
  }
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)

  const app = getApp()
  if (app && typeof app.clearUser === 'function') {
    app.clearUser()
  }
}

function goToLogin() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage && currentPage.route === 'pages/login/index') {
    return
  }

  wx.reLaunch({
    url: '/pages/login/index',
  })
}

function goToHome() {
  wx.switchTab({
    url: '/pages/index/index',
  })
}

function ensureLoggedIn() {
  if (getToken()) {
    return true
  }

  goToLogin()
  return false
}

module.exports = {
  clearSession,
  ensureLoggedIn,
  getToken,
  getUser,
  goToHome,
  goToLogin,
  setSession,
}
