const { ensureLoggedIn } = require('../../auth')
const { formatDateTime, getRecordTypeLabel } = require('../../format')
const { request } = require('../../request')

function showError(error) {
  wx.showToast({
    title: error.message || '操作失败',
    icon: 'none',
  })
}

function showSuccess(title) {
  wx.showToast({
    title,
    icon: 'success',
  })
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

function getCurrentDateTimeValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  const hour = `${now.getHours()}`.padStart(2, '0')
  const minute = `${now.getMinutes()}`.padStart(2, '0')
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  }
}

function getInitialForm() {
  const current = getCurrentDateTimeValue()
  return {
    record_type: 'check_in',
    target_date: current.date,
    target_time: current.time,
    reason: '',
  }
}

Page({
  data: {
    loading: true,
    submitting: false,
    form: getInitialForm(),
    requests: [],
  },

  onShow() {
    if (!ensureLoggedIn()) {
      return
    }

    this.loadMakeupData()
  },

  async loadMakeupData() {
    this.setData({ loading: true })

    try {
      const response = await request({
        url: '/attendance/makeup_requests',
      })
      this.setData({
        requests: (response.makeup_requests || []).map(formatMakeupRequest),
      })
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ loading: false })
    }
  },

  handleTypeChange(event) {
    this.setData({
      'form.record_type': event.detail.value,
    })
  },

  handleDateChange(event) {
    this.setData({
      'form.target_date': event.detail.value,
    })
  },

  handleTimeChange(event) {
    this.setData({
      'form.target_time': event.detail.value,
    })
  },

  handleReasonInput(event) {
    this.setData({
      'form.reason': event.detail.value,
    })
  },

  async handleSubmit() {
    if (this.data.submitting) {
      return
    }

    try {
      this.setData({ submitting: true })
      await request({
        url: '/attendance/makeup_requests',
        method: 'POST',
        data: {
          record_type: this.data.form.record_type,
          target_time: `${this.data.form.target_date} ${this.data.form.target_time}`,
          reason: this.data.form.reason,
        },
      })
      showSuccess('补卡申请已提交')
      this.setData({
        form: getInitialForm(),
      })
      await this.loadMakeupData()
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ submitting: false })
    }
  },
})
