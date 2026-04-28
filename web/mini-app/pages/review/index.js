const { ensureLoggedIn, goToHome } = require('../../auth')
const { formatDateTime, getRecordTypeLabel } = require('../../format')
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

function formatMakeupRequest(item) {
  return Object.assign({}, item, {
    recordTypeLabel: getRecordTypeLabel(item.record_type),
    targetTimeText: formatDateTime(item.target_time),
    createdAtText: formatDateTime(item.created_at),
    reviewedAtText: formatDateTime(item.reviewed_at),
    statusLabel: item.status === 'approved' ? '已通过' : item.status === 'rejected' ? '已驳回' : '待审核',
    statusTone: item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning',
  })
}

Page({
  data: {
    loading: true,
    reviewingRequestId: null,
    isAdmin: false,
    makeupRequests: [],
  },

  onShow() {
    syncTabBar('review')
    wx.showLoading({ title: '加载中' })
    if (!ensureLoggedIn()) {
      wx.hideLoading()
      return
    }

    this.loadReviewData()
  },

  async loadReviewData() {
    this.setData({ loading: true })

    try {
      const [meResponse, makeupResponse] = await Promise.all([
        request({ url: '/auth/me' }),
        request({ url: '/attendance/makeup_requests' }),
      ])

      const isAdmin = !!meResponse.user && meResponse.user.role === 'admin'
      if (!isAdmin) {
        goToHome()
        return
      }

      this.setData({
        isAdmin,
        makeupRequests: (makeupResponse.makeup_requests || []).map(formatMakeupRequest),
      })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  async handleReviewRequest(event) {
    const { id, action } = event.currentTarget.dataset
    if (!id || !action || this.data.reviewingRequestId) {
      return
    }

    try {
      this.setData({ reviewingRequestId: id })
      await request({
        url: `/attendance/makeup_requests/${id}/review`,
        method: 'POST',
        data: {
          action,
          reviewer_comment: action === 'approve' ? '管理员审核通过' : '管理员审核驳回',
        },
      })
      showSuccess(action === 'approve' ? '已通过补卡申请' : '已驳回补卡申请')
      await this.loadReviewData()
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ reviewingRequestId: null })
    }
  },
})
