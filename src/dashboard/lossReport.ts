import { LOSS_STAGE_LABEL, type LossWorkerRow, type WeeklyLossReport } from '../api/lossReports'
import type { XlsxCell, XlsxSheet } from './xlsx'

const DAY_MS = 24 * 60 * 60 * 1000

/** Ngày hôm nay theo giờ máy, YYYY-MM-DD. */
export function todayKey() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(key: string, days: number) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Thứ Hai của tuần chứa ngày `key`. */
export function weekStart(key: string) {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay()
  return addDays(key, -((day + 6) % 7))
}

/** "20/10 – 26/10/2026" */
export function weekLabel(start: string) {
  const end = addDays(start, 6)
  const [y, m, d] = start.split('-')
  const [ey, em, ed] = end.split('-')
  return y === ey ? `${d}/${m} – ${ed}/${em}/${ey}` : `${d}/${m}/${y} – ${ed}/${em}/${ey}`
}

/** "20/10" — nhãn ngắn cho cột tuần khi so sánh. */
export function weekShort(start: string) {
  const [, m, d] = start.split('-')
  return `${d}/${m}`
}

/** Hao thực tế vượt mức cho phép (cả hai đều có số). */
export function isOver(row: { lossPercent: string | null; limitPercent: string | null }) {
  return row.lossPercent != null && row.limitPercent != null && Number(row.lossPercent) > Number(row.limitPercent)
}

export function stagesCaption(row: LossWorkerRow) {
  return row.stages.map((stage) => LOSS_STAGE_LABEL[stage.stage]).join(', ')
}

const num = (value: string | null) => (value == null ? null : Number(value))

/** "20/10/2026 10:05" theo giờ máy. */
function dateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const HEADERS = [
  'Tuần',
  'Thợ',
  'Khâu',
  'Số phiếu',
  'SL sản phẩm',
  'TL giao (g)',
  'Trọng lượng hàng trả (g)',
  'BTP thu hồi (g)',
  'NVL thu hồi (g)',
  'Mạt vụn (g)',
  'Tổng trả lại (g)',
  'Hao hụt (g)',
  'Mức cho phép (%)',
  'Hao thực tế (%)',
]

function sumsCells(
  row: {
    tickets: number
    qty: number
    inGram: string
    productGram: string
    btpGram: string
    nvlGram: string
    returnedGram: string
    lossGram: string
    lossPercent: string | null
    limitPercent: string | null
  },
  scrapGram: string | null,
  bold: boolean,
): XlsxCell[] {
  const gram = bold ? 'boldGram' : 'gram'
  return [
    row.tickets,
    row.qty,
    { value: num(row.inGram), style: gram },
    { value: num(row.productGram), style: gram },
    { value: num(row.btpGram), style: gram },
    { value: num(row.nvlGram), style: gram },
    { value: num(scrapGram), style: gram },
    { value: num(row.returnedGram), style: gram },
    { value: num(row.lossGram), style: gram },
    { value: num(row.limitPercent), style: bold ? 'boldPercent' : 'percent' },
    { value: num(row.lossPercent), style: isOver(row) ? 'warn' : bold ? 'boldPercent' : 'percent' },
  ]
}

/** Các sheet xuất Excel: báo cáo theo tuần (thợ + từng khâu), so sánh tuần, chi tiết phiếu, mạt vụn. */
export function buildLossSheets(report: WeeklyLossReport): XlsxSheet[] {
  const header = (titles: string[]): XlsxCell[] => titles.map((title) => ({ value: title, style: 'bold' }))
  const weekly: XlsxCell[][] = [header(HEADERS)]
  for (const row of report.workers) {
    const week = weekLabel(row.week)
    weekly.push([
      { value: week, style: 'bold' },
      { value: row.workerName, style: 'bold' },
      { value: 'Tổng', style: 'bold' },
      ...sumsCells(row, row.scrapGram, true),
    ])
    for (const stage of row.stages) {
      weekly.push([week, row.workerName, LOSS_STAGE_LABEL[stage.stage], ...sumsCells(stage, null, false)])
    }
  }

  const sheets: XlsxSheet[] = [
    { name: 'Báo cáo tuần', rows: weekly, widths: [22, 24, 12, 9, 11, 13, 22, 14, 14, 12, 15, 12, 16, 15] },
  ]

  if (report.weeks.length > 1) {
    const names = new Map<string, string>()
    const byWorker = new Map<string, Map<string, LossWorkerRow>>()
    for (const row of report.workers) {
      names.set(row.workerKey, row.workerName)
      const weeks = byWorker.get(row.workerKey) ?? new Map<string, LossWorkerRow>()
      weeks.set(row.week, row)
      byWorker.set(row.workerKey, weeks)
    }
    const compare: XlsxCell[][] = [
      header(['Thợ', ...report.weeks.flatMap((week) => [`${weekShort(week.start)} hao (g)`, `${weekShort(week.start)} %`])]),
    ]
    const keys = [...names.keys()].sort((a, b) => names.get(a)!.localeCompare(names.get(b)!, 'vi'))
    for (const key of keys) {
      const weeks = byWorker.get(key)!
      compare.push([
        names.get(key)!,
        ...report.weeks.flatMap((week): XlsxCell[] => {
          const row = weeks.get(week.start)
          if (!row) return [null, null]
          return [
            { value: num(row.lossGram), style: 'gram' },
            { value: num(row.lossPercent), style: isOver(row) ? 'warn' : 'percent' },
          ]
        }),
      ])
    }
    sheets.push({
      name: 'So sánh tuần',
      rows: compare,
      widths: [24, ...report.weeks.flatMap(() => [13, 10])],
    })
  }

  const names = new Map(report.workers.map((row) => [row.workerKey, row.workerName]))
  const detail: XlsxCell[][] = [
    header([
      'Tuần',
      'Thợ',
      'Khâu',
      'Phiếu',
      'Lần',
      'Chốt số lúc',
      'SL',
      'TL giao (g)',
      'Trọng lượng hàng trả (g)',
      'BTP thu hồi (g)',
      'NVL thu hồi (g)',
      'Hao hụt (g)',
      'Hao (%)',
    ]),
  ]
  for (const item of report.items) {
    detail.push([
      weekLabel(item.week),
      names.get(item.workerKey) ?? '',
      LOSS_STAGE_LABEL[item.stage],
      item.ticketCode,
      item.attempt,
      dateTime(item.confirmedAt),
      item.qty,
      { value: num(item.inGram), style: 'gram' },
      { value: num(item.productGram), style: 'gram' },
      { value: num(item.btpGram), style: 'gram' },
      { value: num(item.nvlGram), style: 'gram' },
      { value: num(item.lossGram), style: 'gram' },
      { value: num(item.lossPercent), style: 'percent' },
    ])
  }
  sheets.push({ name: 'Chi tiết phiếu', rows: detail, widths: [22, 24, 12, 14, 6, 20, 8, 13, 22, 14, 14, 12, 10] })

  const scraps: XlsxCell[][] = [header(['Tuần', 'Thợ', 'TL mạt (g)', 'Thủ kho nhận', 'Lúc nhận', 'Ghi chú'])]
  for (const scrap of report.scrapReturns) {
    scraps.push([
      weekLabel(scrap.week),
      scrap.workerName,
      { value: num(scrap.weightGram), style: 'gram' },
      scrap.receivedByName,
      dateTime(scrap.receivedAt),
      scrap.note ?? '',
    ])
  }
  sheets.push({ name: 'Mạt vụn', rows: scraps, widths: [22, 24, 12, 20, 20, 30] })

  const limits: XlsxCell[][] = [header(['Khâu', 'Mức cho phép (%)'])]
  for (const limit of report.limits) {
    limits.push([LOSS_STAGE_LABEL[limit.stage], { value: num(limit.percent), style: 'percent' }])
  }
  sheets.push({ name: 'Mức cho phép', rows: limits, widths: [14, 18] })
  return sheets
}
