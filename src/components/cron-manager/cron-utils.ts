import type { CronRunStatus, CronSortKey, CronJob, CronRun } from './cron-types'

function normalizeTimestampToMs(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatTwoDigits(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatDayValue(value: string, t: any): string {
  const mapping: Record<string, string> = {
    '0': t('common.days.sunday', { defaultValue: 'Sunday' }),
    '1': t('common.days.monday', { defaultValue: 'Monday' }),
    '2': t('common.days.tuesday', { defaultValue: 'Tuesday' }),
    '3': t('common.days.wednesday', { defaultValue: 'Wednesday' }),
    '4': t('common.days.thursday', { defaultValue: 'Thursday' }),
    '5': t('common.days.friday', { defaultValue: 'Friday' }),
    '6': t('common.days.saturday', { defaultValue: 'Saturday' }),
  }
  return mapping[value] ?? value
}

export function formatCronHuman(expression: string, t: any): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length < 5) return expression

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  if (
    minute === '*' &&
    hour === '*' &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return t('common.cron.everyMinute', { defaultValue: 'Every minute' })
  }

  if (
    minute.startsWith('*/') &&
    hour === '*' &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    const interval = Number(minute.slice(2))
    if (Number.isFinite(interval) && interval > 0) {
      return t('common.cron.everyXMinutes', { count: interval, defaultValue: `Every ${interval} minutes` })
    }
  }

  if (
    /^\d+$/.test(minute) &&
    hour === '*' &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return t('common.cron.atMinuteX', { minute, defaultValue: `At minute ${minute} past every hour` })
  }

  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return t('common.cron.everyDayAt', {
      time: `${formatTwoDigits(Number(hour))}:${formatTwoDigits(Number(minute))}`,
      defaultValue: `Every day at ${formatTwoDigits(Number(hour))}:${formatTwoDigits(Number(minute))}`
    })
  }

  if (
    /^\d+$/.test(minute) &&
    /^\d+$/.test(hour) &&
    dayOfMonth === '*' &&
    month === '*' &&
    /^\d$/.test(dayOfWeek)
  ) {
    return t('common.cron.everyDayOfWeekAt', {
      day: formatDayValue(dayOfWeek, t),
      time: `${formatTwoDigits(Number(hour))}:${formatTwoDigits(Number(minute))}`,
      defaultValue: `Every ${formatDayValue(dayOfWeek, t)} at ${formatTwoDigits(Number(hour))}:${formatTwoDigits(Number(minute))}`
    })
  }

  return expression
}

export function formatDateTime(value: string | null | undefined, t: any): string {
  if (!value) return t('common.never', { defaultValue: 'Never' })
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value

  return new Intl.DateTimeFormat(t.language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(parsed))
}

export function formatDuration(valueMs: number | undefined, t: any): string {
  if (!valueMs || valueMs <= 0) return 'n/a'
  if (valueMs < 1000) return `${Math.round(valueMs)}ms`
  if (valueMs < 60_000) return t('common.seconds', { count: parseFloat((valueMs / 1000).toFixed(1)), defaultValue: `${(valueMs / 1000).toFixed(1)}s` })
  return t('common.minutes', { count: parseFloat((valueMs / 60_000).toFixed(1)), defaultValue: `${(valueMs / 60_000).toFixed(1)}m` })
}

export function statusLabel(status: CronRunStatus, t: any): string {
  return t(`cron.runStatus.${status}`, { defaultValue: status })
}

export function sortCronJobs(
  jobs: Array<CronJob>,
  sortKey: CronSortKey,
): Array<CronJob> {
  return [...jobs].sort(function sortJobs(a, b) {
    if (sortKey === 'name') {
      return a.name.localeCompare(b.name)
    }
    if (sortKey === 'schedule') {
      return a.schedule.localeCompare(b.schedule)
    }

    const aLastRun = normalizeTimestampToMs(a.lastRun?.startedAt)
    const bLastRun = normalizeTimestampToMs(b.lastRun?.startedAt)
    return bLastRun - aLastRun
  })
}

export function getLatestRun(
  job: CronJob,
  runs: Array<CronRun>,
): CronRun | undefined {
  if (runs.length > 0) return runs[0]
  return job.lastRun
}

export function statusBadgeClass(status: CronRunStatus): string {
  if (status === 'success') {
    return 'border-primary-300 bg-primary-100 text-primary-800'
  }
  if (status === 'error') {
    return 'border-orange-500/40 bg-orange-500/15 text-orange-500'
  }
  if (status === 'running') {
    return 'border-primary-400 bg-primary-100 text-primary-900'
  }
  if (status === 'queued') {
    return 'border-primary-300 bg-primary-100 text-primary-700'
  }
  return 'border-primary-300 bg-primary-100 text-primary-700'
}
