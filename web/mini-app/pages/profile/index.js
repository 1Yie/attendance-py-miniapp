const { clearSession, ensureLoggedIn } = require('../../auth')
const { formatDateTime } = require('../../format')
const { request } = require('../../request')

function showError(error) {
  wx.showToast({
    title: error.message || '加载失败',
    icon: 'none',
  })
}

function syncTabBar(key) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (!currentPage || typeof currentPage.getTabBar !== 'function') {
    return
  }

  const tabBar = currentPage.getTabBar()
  if (tabBar) {
    if (typeof tabBar.refreshTabs === 'function') {
      tabBar.refreshTabs()
    }
    tabBar.setData({ selected: key })
  }
}

function mapUser(user) {
  return Object.assign({}, user, {
    avatarText: (user.name || '').slice(0, 1) || '我',
    roleLabel: user.role === 'admin' ? '管理员' : '员工',
    lastLoginAtText: formatDateTime(user.last_login_at),
  })
}

Page({
  data: {
    loading: true,
    user: null,
    apiBaseUrl: '',
  },

  onShow() {
    syncTabBar('profile')
    wx.showLoading({ title: '加载中' })
    if (!ensureLoggedIn()) {
      wx.hideLoading()
      return
    }

    const app = getApp()
    this.setData({
      apiBaseUrl: (app && app.globalData && app.globalData.baseUrl) || '',
    })
    this.loadProfile()
  },

  async loadProfile() {
    this.setData({ loading: true })

    try {
      const response = await request({
        url: '/auth/me',
      })

      this.setData({
        user: mapUser(response.user),
      })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  handleLogout() {
    clearSession()
    wx.reLaunch({
      url: '/pages/login/index',
    })
  },

  handleOpenAdmin() {
    wx.navigateTo({
      url: '/pages/admin/index',
    })
  },

  handleOpenMakeup() {
    wx.navigateTo({
      url: '/pages/makeup/index',
    })
  },
})
