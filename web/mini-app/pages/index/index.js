const { ensureLoggedIn } = require('../../auth')
const { enrichRecord } = require('../../format')
const { request } = require('../../request')

const SESSION_PROMPT_KEY = 'attendance_prompt_session_id'
const SESSION_POLL_INTERVAL = 10000

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

function formatDateTime(value) {
  if (!value) {
    return '--'
  }

  return String(value).replace('T', ' ').slice(0, 16)
}

function formatCurrentSession(session) {
  if (!session) {
    return null
  }

  const submission = session.submission || null
  return Object.assign({}, session, {
    createdAtText: formatDateTime(session.created_at),
    deadlineAtText: formatDateTime(session.deadline_at),
    hasSubmitted: !!session.has_submitted,
    submittedAtText: submission ? formatDateTime(submission.submitted_at) : '--',
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
    sessionSubmitting: false,
    user: null,
    isStudent: false,
    config: null,
    currentSession: null,
    todayRecords: [],
    latestRecord: null,
  },

  onLoad() {
    this.startClock()
  },

  onShow() {
    this.startClock()
    syncTabBar('clock')
    wx.showLoading({ title: '加载中' })
    if (!ensureLoggedIn()) {
      wx.hideLoading()
      return
    }

    this.loadPageData()
  },

  onHide() {
    this.stopClock()
    this.stopSessionPolling()
  },

  onUnload() {
    this.stopClock()
    this.stopSessionPolling()
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

  startSessionPolling() {
    this.stopSessionPolling()
    this.sessionPollTimer = setInterval(() => {
      this.refreshCurrentSession({ silent: true })
    }, SESSION_POLL_INTERVAL)
  },

  stopSessionPolling() {
    if (this.sessionPollTimer) {
      clearInterval(this.sessionPollTimer)
      this.sessionPollTimer = null
    }
  },

  maybePromptSession(session) {
    if (!session || session.hasSubmitted) {
      return
    }

    const promptSessionId = `${wx.getStorageSync(SESSION_PROMPT_KEY) || ''}`
    if (promptSessionId === `${session.id}`) {
      return
    }

    wx.setStorageSync(SESSION_PROMPT_KEY, session.id)
    wx.showModal({
      title: '课堂考勤提醒',
      content: `教师已发起课堂考勤，请在 ${session.deadlineAtText} 前完成签到。`,
      confirmText: '知道了',
      showCancel: false,
    })
  },

  async refreshCurrentSession(options = {}) {
    const user = this.data.user
    if (!user || user.role !== 'employee') {
      return
    }

    try {
      const response = await request({
        url: '/attendance/sessions/current',
      })
      const currentSession = formatCurrentSession(response.session)
      this.setData({ currentSession })
      this.maybePromptSession(currentSession)
    } catch (error) {
      if (!options.silent) {
        showError(error)
      }
    }
  },

  async loadPageData() {
    this.setData({ loading: true })

    try {
      const [meResponse, configResponse, recordsResponse, sessionResponse] = await Promise.all([
        request({ url: '/auth/me' }),
        request({ url: '/attendance/config' }),
        request({ url: '/attendance/records' }),
        request({ url: '/attendance/sessions/current' }),
      ])

      const today = getTodayDateString()
      const records = (recordsResponse.records || []).map(enrichRecord)
      const todayRecords = records.filter((record) => record.record_date === today)
      const isStudent = !!meResponse.user && meResponse.user.role === 'employee'
      const currentSession = isStudent ? formatCurrentSession(sessionResponse.session) : null

      this.setData({
        user: meResponse.user,
        isStudent,
        config: configResponse.config,
        currentSession,
        todayRecords,
        latestRecord: records[0] || null,
        loading: false,
      })

      const app = getApp()
      if (app && typeof app.setUser === 'function') {
        app.setUser(meResponse.user)
      }

      if (isStudent) {
        this.maybePromptSession(currentSession)
        this.startSessionPolling()
      } else {
        this.stopSessionPolling()
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

  async handleSessionSubmit() {
    const session = this.data.currentSession
    if (!session || session.hasSubmitted || this.data.sessionSubmitting) {
      return
    }

    try {
      this.setData({ sessionSubmitting: true })
      const response = await request({
        url: `/attendance/sessions/${session.id}/submit`,
        method: 'POST',
      })

      wx.showToast({
        title: response.message || '签到成功',
        icon: 'success',
      })
      this.setData({
        currentSession: formatCurrentSession(response.session),
      })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ sessionSubmitting: false })
    }
  },

  handleOpenMakeup() {
    wx.navigateTo({
      url: '/pages/makeup/index',
    })
  },
})
