const { ensureLoggedIn } = require('../../auth')
const { request } = require('../../request')

const SESSION_POLL_INTERVAL = 10000

function showError(error) {
  wx.showToast({
    title: error.message || '加载失败',
    icon: 'none',
  })
}

function showSuccess(title) {
  wx.showToast({
    title,
    icon: 'success',
  })
}

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

  return Object.assign({}, session, {
    createdAtText: formatDateTime(session.created_at),
    deadlineAtText: formatDateTime(session.deadline_at),
    submissions: session.submissions || [],
    pending_students: session.pending_students || [],
  })
}

function getInitialUserForm() {
  return {
    id: null,
    phone: '',
    name: '',
    position: '',
    password: '',
    role: 'employee',
  }
}

Page({
  data: {
    loading: true,
    savingConfig: false,
    launchingSession: false,
    creatingUser: false,
    currentSession: null,
    configForm: {
      work_start: '09:00',
      work_end: '18:00',
      check_in_limit: '1',
      check_out_limit: '1',
      makeup_limit_per_month: '3',
      makeup_requires_approval: true,
    },
    sessionForm: getInitialSessionForm(),
    userForm: getInitialUserForm(),
    users: [],
  },

  onShow() {
    wx.showLoading({ title: '加载中' })
    if (!ensureLoggedIn()) {
      wx.hideLoading()
      return
    }

    this.loadAdminData()
  },

  onHide() {
    this.stopSessionPolling()
  },

  onUnload() {
    this.stopSessionPolling()
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

  async refreshCurrentSession(options = {}) {
    try {
      const response = await request({ url: '/attendance/sessions/current' })
      const currentSession = formatCurrentSession(response.session)
      this.setData({ currentSession })
      return currentSession
    } catch (error) {
      if (!options.silent) {
        showError(error)
      }
      return null
    }
  },

  async loadAdminData() {
    this.setData({ loading: true })

    try {
      const [meResponse, configResponse, usersResponse, sessionResponse] = await Promise.all([
        request({ url: '/auth/me' }),
        request({ url: '/attendance/config' }),
        request({ url: '/auth/users' }),
        request({ url: '/attendance/sessions/current' }),
      ])

      if (!meResponse.user || meResponse.user.role !== 'admin') {
        wx.showToast({
          title: '仅教师可访问',
          icon: 'none',
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 300)
        return
      }

      this.setData({
        configForm: {
          work_start: configResponse.config.work_start,
          work_end: configResponse.config.work_end,
          check_in_limit: `${configResponse.config.check_in_limit}`,
          check_out_limit: `${configResponse.config.check_out_limit}`,
          makeup_limit_per_month: `${configResponse.config.makeup_limit_per_month}`,
          makeup_requires_approval: !!configResponse.config.makeup_requires_approval,
        },
        currentSession: formatCurrentSession(sessionResponse.session),
        users: usersResponse.users || [],
      })
      this.startSessionPolling()
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  handleConfigInput(event) {
    const { field } = event.currentTarget.dataset
    this.setData({
      [`configForm.${field}`]: event.detail.value,
    })
  },

  handleConfigPicker(event) {
    const field = event.currentTarget.dataset.field
    // picker change event returns an object with "detail.value"
    const value = event.detail && event.detail.value
    if (!field) return
    this.setData({
      [`configForm.${field}`]: value,
    })
  },

  handleApprovalSwitch(event) {
    this.setData({
      'configForm.makeup_requires_approval': !!event.detail.value,
    })
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
    if (this.data.launchingSession) {
      return
    }

    try {
      this.setData({ launchingSession: true })
      const currentSession = await this.refreshCurrentSession({ silent: true })
      if (currentSession) {
        showError({ message: '当前已有进行中的考勤' })
        return
      }

      await request({
        url: '/attendance/sessions',
        method: 'POST',
        data: {
          deadline_at: `${this.data.sessionForm.deadline_date} ${this.data.sessionForm.deadline_time}`,
        },
      })
      showSuccess('考勤已发起')
      this.setData({
        sessionForm: getInitialSessionForm(),
      })
      await this.loadAdminData()
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ launchingSession: false })
    }
  },

  async handleSaveConfig() {
    if (this.data.savingConfig) {
      return
    }

    try {
      this.setData({ savingConfig: true })
      await request({
        url: '/attendance/config',
        method: 'PUT',
        data: {
          work_start: this.data.configForm.work_start,
          work_end: this.data.configForm.work_end,
          check_in_limit: Number(this.data.configForm.check_in_limit),
          check_out_limit: Number(this.data.configForm.check_out_limit),
          makeup_limit_per_month: Number(this.data.configForm.makeup_limit_per_month),
          makeup_requires_approval: this.data.configForm.makeup_requires_approval,
        },
      })
      showSuccess('设置已保存')
      await this.loadAdminData()
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ savingConfig: false })
      wx.hideLoading()
    }
  },

  handleUserInput(event) {
    const { field } = event.currentTarget.dataset
    this.setData({
      [`userForm.${field}`]: event.detail.value,
    })
  },

  handleRoleChange(event) {
    this.setData({
      'userForm.role': event.detail.value,
    })
  },

  async handleCreateUser() {
    if (this.data.creatingUser) {
      return
    }

    try {
      this.setData({ creatingUser: true })
      const isEditing = !!this.data.userForm.id
      await request({
        url: isEditing ? `/auth/users/${this.data.userForm.id}` : '/auth/users',
        method: isEditing ? 'PUT' : 'POST',
        data: {
          phone: this.data.userForm.phone,
          name: this.data.userForm.name,
          position: this.data.userForm.position,
          password: this.data.userForm.password,
          role: this.data.userForm.role,
        },
      })
      showSuccess(isEditing ? '账号已更新' : '账号已创建')
      this.setData({
        userForm: getInitialUserForm(),
      })
      await this.loadAdminData()
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ creatingUser: false })
    }
  },

  handleEditUser(event) {
    const { user } = event.currentTarget.dataset
    if (!user) {
      return
    }

    this.setData({
      userForm: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        position: user.position,
        password: '',
        role: user.role,
      },
    })

    wx.pageScrollTo({
      scrollTop: 520,
      duration: 200,
    })
  },

  handleResetUserForm() {
    this.setData({
      userForm: getInitialUserForm(),
    })
  },

})
