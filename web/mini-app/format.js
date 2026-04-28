const STATUS_LABEL_MAP = {
  normal: '正常',
  late: '迟到',
  early_leave: '早退',
}

const STATUS_TONE_MAP = {
  normal: 'success',
  late: 'warning',
  early_leave: 'danger',
}

const RECORD_TYPE_LABEL_MAP = {
  check_in: '上班打卡',
  check_out: '下班打卡',
}

function formatDate(value) {
  if (!value) {
    return '--'
  }

  return String(value).split('T')[0]
}

function formatTime(value) {
  if (!value) {
    return '--'
  }

  const text = String(value)
  if (text.includes('T')) {
    return text.split('T')[1].slice(0, 5)
  }

  return text.slice(0, 5)
}

function formatDateTime(value) {
  if (!value) {
    return '--'
  }

  return String(value).replace('T', ' ').slice(0, 16)
}

function getStatusLabel(status) {
  return STATUS_LABEL_MAP[status] || status || '--'
}

function getStatusTone(status) {
  return STATUS_TONE_MAP[status] || 'neutral'
}

function getRecordTypeLabel(type) {
  return RECORD_TYPE_LABEL_MAP[type] || type || '--'
}

function enrichRecord(record) {
  return Object.assign({}, record, {
    recordTypeLabel: getRecordTypeLabel(record.record_type),
    statusLabel: getStatusLabel(record.status),
    statusTone: getStatusTone(record.status),
    checkTimeText: formatDateTime(record.check_time),
    checkTimeShort: formatTime(record.check_time),
    recordDateText: formatDate(record.record_date),
  })
}

module.exports = {
  enrichRecord,
  formatDate,
  formatDateTime,
  formatTime,
  getRecordTypeLabel,
  getStatusLabel,
  getStatusTone,
}
