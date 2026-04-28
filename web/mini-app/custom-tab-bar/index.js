const { getUser } = require('../auth')

const ALL_TABS = [
  { key: 'clock', text: '打卡', path: '/pages/index/index' },
  { key: 'attendance', text: '考勤', path: '/pages/attendance/index' },
  { key: 'review', text: '审核', path: '/pages/review/index', adminOnly: true },
  { key: 'profile', text: '我的', path: '/pages/profile/index' },
]

Component({
  data: {
    selected: 'clock',
    tabs: [],
  },

  lifetimes: {
    attached() {
      this.refreshTabs()
    },
  },

  methods: {
    refreshTabs() {
      const user = getUser()
      const isAdmin = !!user && user.role === 'admin'
      this.setData({
        tabs: ALL_TABS.filter((item) => !item.adminOnly || isAdmin),
      })
    },

    handleSwitch(event) {
      const { key, path } = event.currentTarget.dataset
      if (key === this.data.selected) {
        return
      }

      this.setData({ selected: key })
      wx.switchTab({
        url: path,
      })
    },
  },
})
