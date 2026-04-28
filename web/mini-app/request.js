const { clearSession, getToken, goToLogin } = require('./auth')

function getBaseUrl() {
  const app = getApp()
  return (app && app.globalData && app.globalData.baseUrl) || 'http://127.0.0.1:5000'
}

function request(options) {
  return new Promise((resolve, reject) => {
    const header = Object.assign(
      {
        'Content-Type': 'application/json',
      },
      options.header || {},
    )

    if (options.auth !== false) {
      const token = getToken()
      if (token) {
        header.Authorization = `Bearer ${token}`
      }
    }

    wx.request({
      url: `${getBaseUrl()}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }

        const message = (res.data && res.data.message) || '请求失败'
        if (res.statusCode === 401 && options.auth !== false) {
          clearSession()
          goToLogin()
        }

        reject({
          statusCode: res.statusCode,
          message,
          data: res.data,
        })
      },
      fail(error) {
        reject({
          message: '无法连接服务器，请确认 Flask 服务已启动',
          error,
        })
      },
    })
  })
}

module.exports = {
  request,
}
