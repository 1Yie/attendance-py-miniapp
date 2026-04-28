const { ensureLoggedIn } = require('../../auth')
const { enrichRecord } = require('../../format')
const { request } = require('../../request')

function getTodayDateString() {
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

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

Page({
  data: {
    currentDateText: '',
    currentTimeText: '',
    loading: true,
    submittingType: '',
    user: null,
    config: null,
    todayRecords: [],
    latestRecord: null,
  },

  onLoad() {
    this.startClock()
  },

  onShow() {
    this.startClock()
    syncTabBar('clock')
    if (!ensureLoggedIn()) {
      wx.hideLoading()
      return
    }

    this.loadPageData()
  },

  onHide() {
    this.stopClock()
  },

  onUnload() {
    this.stopClock()
  },

  startClock() {
    this.stopClock()
    this.updateClock()
    this.clockTimer = setInterval(() => {
      this.updateClock()
    }, 1000)
  },

  stopClock() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer)
      this.clockTimer = null
    }
  },

  updateClock() {
    const now = new Date()
    const month = `${now.getMonth() + 1}`.padStart(2, '0')
    const day = `${now.getDate()}`.padStart(2, '0')
    const hour = `${now.getHours()}`.padStart(2, '0')
    const minute = `${now.getMinutes()}`.padStart(2, '0')
    const second = `${now.getSeconds()}`.padStart(2, '0')

    this.setData({
      currentDateText: `${now.getFullYear()}-${month}-${day}`,
      currentTimeText: `${hour}:${minute}:${second}`,
    })
  },

  async loadPageData() {
    this.setData({ loading: true })

    try {
      const [meResponse, configResponse, recordsResponse] = await Promise.all([
        request({ url: '/auth/me' }),
        request({ url: '/attendance/config' }),
        request({ url: '/attendance/records' }),
      ])

      const today = getTodayDateString()
      const records = (recordsResponse.records || []).map(enrichRecord)
      const todayRecords = records.filter((record) => record.record_date === today)

      this.setData({
        user: meResponse.user,
        config: configResponse.config,
        todayRecords,
        latestRecord: records[0] || null,
        loading: false,
      })

      const app = getApp()
      if (app && typeof app.setUser === 'function') {
        app.setUser(meResponse.user)
      }
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  async handlePunch(event) {
    const type = event.currentTarget.dataset.type
    if (this.data.submittingType) {
      return
    }

    const url = type === 'check_in' ? '/attendance/check_in' : '/attendance/check_out'
    try {
      this.setData({ submittingType: type })
      const response = await request({
        url,
        method: 'POST',
      })

      wx.showToast({
        title: response.message || '打卡成功',
        icon: 'success',
      })
      await this.loadPageData()
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ submittingType: '' })
    }
  },

  handleOpenMakeup() {
    wx.navigateTo({
      url: '/pages/makeup/index',
    })
  },
})
