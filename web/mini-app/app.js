const { getUser } = require('./auth')

App({
  globalData: {
    baseUrl: 'http://127.0.0.1:5000',
    user: null,
  },

  onLaunch() {
    this.globalData.user = getUser()
  },

  setUser(user) {
    this.globalData.user = user
  },

  clearUser() {
    this.globalData.user = null
  },
})
