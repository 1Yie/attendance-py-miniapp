const { ensureLoggedIn } = require('../../auth')
const { enrichRecord } = require('../../format')
const { request } = require('../../request')

const SESSION_PROMPT_KEY = 'attendance_prompt_session_id'
const SESSION_POLL_INTERVAL = 5000

function padNumber(value) {
  return `${value}`.padStart(2, '0')
}

function getInitialSessionForm() {
  const defaultDeadline = new Date(Date.now() + 10 * 60 * 1000)
  return {
    deadline_date: `${defaultDeadline.getFullYear()}-${padNumber(defaultDeadline.getMonth() + 1)}-${padNumber(defaultDeadline.getDate())}`,
    deadline_time: `${padNumber(defaultDeadline.getHours())}:${padNumber(defaultDeadline.getMinutes())}`,
  }
}

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
    studentCount: Number(session.student_count || 0),
    submittedCount: Number(session.submitted_count || 0),
    pendingCount: Number(session.pending_count || 0),
    statusLabel: session.status_label || '--',
    statusTone: session.status_tone || 'neutral',
    submissions: session.submissions || [],
    pendingStudents: session.pending_students || [],
  })
}

function formatSessionHistoryItem(session) {
  const formatted = formatCurrentSession(session)
  if (!formatted) {
    return null
  }

  return Object.assign({}, formatted, {
    completionText: formatted.hasSubmitted ? `你已于 ${formatted.submittedAtText} 签到` : '你未参与本次课堂考勤',
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
    launchingSession: false,
    sessionSubmitting: false,
    user: null,
    isStudent: false,
    isTeacher: false,
    config: null,
    currentSession: null,
    sessionForm: getInitialSessionForm(),
    sessionHistory: [],
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
    if (!user) {
      return null
    }

    try {
      const response = await request({
        url: '/attendance/sessions/current',
      })
      const currentSession = formatCurrentSession(response.session)
      this.setData({ currentSession })
      if (user.role === 'employee') {
        this.maybePromptSession(currentSession)
      }
      if (options.refreshHistory) {
        await this.loadSessionHistory({ silent: true })
      }
      return currentSession
    } catch (error) {
      if (!options.silent) {
        showError(error)
      }
      return null
    }
  },

  async loadPageData() {
    this.setData({ loading: true })

    try {
      const [meResponse, configResponse, recordsResponse, sessionResponse, sessionHistoryResponse] = await Promise.all([
        request({ url: '/auth/me' }),
        request({ url: '/attendance/config' }),
        request({ url: '/attendance/records' }),
        request({ url: '/attendance/sessions/current' }),
        request({ url: '/attendance/sessions?limit=10' }),
      ])

      const today = getTodayDateString()
      const records = (recordsResponse.records || []).map(enrichRecord)
      const todayRecords = records.filter((record) => record.record_date === today)
      const isStudent = !!meResponse.user && meResponse.user.role === 'employee'
      const isTeacher = !!meResponse.user && meResponse.user.role === 'admin'
      const currentSession = (isStudent || isTeacher) ? formatCurrentSession(sessionResponse.session) : null
      const sessionHistory = (sessionHistoryResponse.sessions || []).map(formatSessionHistoryItem).filter(Boolean)

      this.setData({
        user: meResponse.user,
        isStudent,
        isTeacher,
        config: configResponse.config,
        currentSession,
        sessionHistory,
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
      }

      if (isStudent || isTeacher) {
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

  async loadSessionHistory(options = {}) {
    try {
      const response = await request({
        url: '/attendance/sessions?limit=10',
      })
      this.setData({
        sessionHistory: (response.sessions || []).map(formatSessionHistoryItem).filter(Boolean),
      })
    } catch (error) {
      if (!options.silent) {
        showError(error)
      }
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
      await this.refreshCurrentSession({ silent: true, refreshHistory: true })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ sessionSubmitting: false })
    }
  },

  handleSessionPicker(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail && event.detail.value
    if (!field) {
      return
    }

    this.setData({
      [`sessionForm.${field}`]: value,
    })
  },

  async handleLaunchSession() {
    if (!this.data.isTeacher || this.data.launchingSession) {
      return
    }

    try {
      this.setData({ launchingSession: true })
      const currentSession = await this.refreshCurrentSession({ silent: true })
      if (currentSession) {
        showError({ message: '当前已有进行中的考勤' })
        return
      }

      const response = await request({
        url: '/attendance/sessions',
        method: 'POST',
        data: {
          deadline_at: `${this.data.sessionForm.deadline_date} ${this.data.sessionForm.deadline_time}`,
        },
      })

      this.setData({
        currentSession: formatCurrentSession(response.session),
        sessionForm: getInitialSessionForm(),
      })
      await this.loadSessionHistory({ silent: true })
      wx.showToast({
        title: response.message || '考勤已发起',
        icon: 'success',
      })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ launchingSession: false })
    }
  },

  handleOpenMakeup() {
    wx.navigateTo({
      url: '/pages/makeup/index',
    })
  },
})
