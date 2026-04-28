const { ensureLoggedIn } = require('../../auth')
const { request } = require('../../request')

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
    creatingUser: false,
    configForm: {
      work_start: '09:00',
      work_end: '18:00',
      check_in_limit: '1',
      check_out_limit: '1',
      makeup_limit_per_month: '3',
      makeup_requires_approval: true,
    },
    userForm: getInitialUserForm(),
    users: [],
  },

  onShow() {
    if (!ensureLoggedIn()) {
      return
    }

    this.loadAdminData()
  },

  async loadAdminData() {
    this.setData({ loading: true })

    try {
      const [meResponse, configResponse, usersResponse] = await Promise.all([
        request({ url: '/auth/me' }),
        request({ url: '/attendance/config' }),
        request({ url: '/auth/users' }),
      ])

      if (!meResponse.user || meResponse.user.role !== 'admin') {
        wx.showToast({
          title: '仅管理员可访问',
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
        users: usersResponse.users || [],
      })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ loading: false })
    }
  },

  handleConfigInput(event) {
    const { field } = event.currentTarget.dataset
    this.setData({
      [`configForm.${field}`]: event.detail.value,
    })
  },

  handleApprovalSwitch(event) {
    this.setData({
      'configForm.makeup_requires_approval': !!event.detail.value,
    })
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
