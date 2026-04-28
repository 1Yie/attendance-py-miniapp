const { getToken, goToHome, setSession } = require('../../auth')
const { request } = require('../../request')

function showError(error) {
  wx.showToast({
    title: error.message || '登录失败',
    icon: 'none',
  })
}

Page({
  data: {
    form: {
      phone: '',
      password: '',
    },
    submitting: false,
  },

  onShow() {
    if (getToken()) {
      goToHome()
      return
    }

    wx.hideLoading()
  },

  handlePhoneInput(event) {
    this.setData({
      'form.phone': event.detail.value.trim(),
    })
  },

  handlePasswordInput(event) {
    this.setData({
      'form.password': event.detail.value,
    })
  },

  async handleLogin() {
    if (this.data.submitting) {
      return
    }

    try {
      this.setData({ submitting: true })
      const response = await request({
        url: '/auth/login',
        method: 'POST',
        auth: false,
        data: this.data.form,
      })

      setSession(response.token, response.user)
      wx.showToast({
        title: '登录成功',
        icon: 'success',
      })

      setTimeout(() => {
        goToHome()
      }, 120)
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ submitting: false })
    }
  },
})
