const { ensureLoggedIn } = require('../../auth')
const { enrichRecord } = require('../../format')
const { request } = require('../../request')

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日']
const WEEK_DAY_FULL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function showError(error) {
  wx.showToast({
    title: error.message || '加载失败',
    icon: 'none',
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

function padNumber(value) {
  return `${value}`.padStart(2, '0')
}

function getMonthKey(year, month) {
  return `${year}-${padNumber(month)}`
}

function getDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

function getTodayKey() {
  return getDateKey(new Date())
}

function getWeekDayIndex(date) {
  return (date.getDay() + 6) % 7
}

function getWeekDayText(dateKey) {
  const [yearText, monthText, dayText] = dateKey.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText))
  return WEEK_DAY_FULL[getWeekDayIndex(date)]
}

function formatDisplayDate(dateKey) {
  if (!dateKey) {
    return '选中日期'
  }

  const [, monthText, dayText] = dateKey.split('-')
  return `${Number(monthText)}月${Number(dayText)}日 ${getWeekDayText(dateKey)}`
}

function buildDaySummary(records) {
  const hasLate = records.some((item) => item.status === 'late')
  const hasEarlyLeave = records.some((item) => item.status === 'early_leave')
  const hasManual = records.some((item) => item.is_manual)

  if (hasLate) {
    return { label: '迟到', tone: 'warning' }
  }
  if (hasEarlyLeave) {
    return { label: '早退', tone: 'danger' }
  }
  if (hasManual) {
    return { label: '补卡', tone: 'info' }
  }
  return { label: '正常', tone: 'success' }
}

function buildMonthData(records, currentMonth) {
  const [yearText, monthText] = currentMonth.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const leading = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()
  const groupedByDate = {}

  records.forEach((record) => {
    if (!groupedByDate[record.record_date]) {
      groupedByDate[record.record_date] = []
    }
    groupedByDate[record.record_date].push(record)
  })

  const cells = []
  for (let i = 0; i < leading; i += 1) {
    cells.push({ id: `empty-start-${i}`, isEmpty: true })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${currentMonth}-${padNumber(day)}`
    const dayRecords = groupedByDate[dateKey] || []
    const summary = dayRecords.length ? buildDaySummary(dayRecords) : null

    cells.push({
      id: dateKey,
      dateKey,
      day,
      isEmpty: false,
      isToday: dateKey === getTodayKey(),
      hasRecord: dayRecords.length > 0,
      summaryLabel: summary ? summary.label : '',
      summaryTone: summary ? summary.tone : '',
      recordCount: dayRecords.length,
    })
  }

  while (cells.length % 7 !== 0) {
    const suffix = cells.length
    cells.push({ id: `empty-end-${suffix}`, isEmpty: true })
  }

  return {
    title: `${month}月`,
    yearText: `${year}`,
    metaText: `共 ${daysInMonth} 天`,
    cells,
    weekDays: WEEK_DAYS,
  }
}

function buildMonthStats(records, monthKey) {
  const monthRecords = records.filter((item) => item.record_date.startsWith(monthKey))

  return {
    total: monthRecords.length,
    normal: monthRecords.filter((item) => item.status === 'normal').length,
    late: monthRecords.filter((item) => item.status === 'late').length,
    manual: monthRecords.filter((item) => item.is_manual).length,
  }
}

Page({
  data: {
    loading: true,
    records: [],
    currentMonth: '',
    calendarTitle: '',
    calendarYearText: '',
    calendarMetaText: '',
    calendarDays: [],
    weekDays: WEEK_DAYS,
    selectedDate: '',
    selectedDateText: '',
    selectedRecords: [],
    stats: {
      total: 0,
      normal: 0,
      late: 0,
      manual: 0,
    },
  },

  onLoad() {
    const now = new Date()
    this.setData({
      currentMonth: getMonthKey(now.getFullYear(), now.getMonth() + 1),
    })
  },

  onShow() {
    syncTabBar('attendance')
    if (!ensureLoggedIn()) {
      wx.hideLoading()
      return
    }

    this.loadRecords()
  },

  async loadRecords() {
    this.setData({ loading: true })

    try {
      const response = await request({
        url: '/attendance/records',
      })
      const records = (response.records || []).map(enrichRecord)
      const todayKey = getTodayKey()
      const fallbackDate = todayKey.startsWith(this.data.currentMonth) ? todayKey : `${this.data.currentMonth}-01`
      const selectedDate = this.data.selectedDate && this.data.selectedDate.startsWith(this.data.currentMonth)
        ? this.data.selectedDate
        : fallbackDate

      this.setData({
        records,
      })
      this.refreshCalendar(records, this.data.currentMonth, selectedDate)
    } catch (error) {
      showError(error)
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  refreshCalendar(records, monthKey, selectedDate) {
    const monthData = buildMonthData(records, monthKey)
    const selectedRecords = records.filter((item) => item.record_date === selectedDate)
    const stats = buildMonthStats(records, monthKey)

    this.setData({
      currentMonth: monthKey,
      calendarTitle: monthData.title,
      calendarYearText: monthData.yearText,
      calendarMetaText: monthData.metaText,
      calendarDays: monthData.cells,
      weekDays: monthData.weekDays,
      selectedDate,
      selectedDateText: formatDisplayDate(selectedDate),
      selectedRecords,
      stats,
    })
  },

  handleSelectDate(event) {
    const { date } = event.currentTarget.dataset
    if (!date) {
      return
    }

    this.refreshCalendar(this.data.records, this.data.currentMonth, date)
  },

  handlePrevMonth() {
    const [yearText, monthText] = this.data.currentMonth.split('-')
    const baseDate = new Date(Number(yearText), Number(monthText) - 2, 1)
    const nextMonthKey = getMonthKey(baseDate.getFullYear(), baseDate.getMonth() + 1)
    const selectedDate = `${nextMonthKey}-01`
    this.refreshCalendar(this.data.records, nextMonthKey, selectedDate)
  },

  handleNextMonth() {
    const [yearText, monthText] = this.data.currentMonth.split('-')
    const baseDate = new Date(Number(yearText), Number(monthText), 1)
    const nextMonthKey = getMonthKey(baseDate.getFullYear(), baseDate.getMonth() + 1)
    const selectedDate = `${nextMonthKey}-01`
    this.refreshCalendar(this.data.records, nextMonthKey, selectedDate)
  },
})
