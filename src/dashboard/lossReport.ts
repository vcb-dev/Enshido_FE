import { lossInHeader, LOSS_STAGE_LABEL, type LossWorkerRow, type WeeklyLossReport } from '../api/lossReports'
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

const headers = (report: WeeklyLossReport) => [
  'Tuần',
  'Thợ',
  'Số lượng sản phẩm trong tuần',
  `${lossInHeader(report.metal)} (g)`,
  'Tổng trọng lượng trả lại (g)',
  'Trọng lượng hàng trả (sản phẩm) (g)',
  'Trọng lượng bán thành phẩm thu hồi (lưu kho để sử dụng sau) (g)',
  'Trọng lượng NVL thu hồi (g)',
  'Trọng lượng mạt vụn thu hồi (sau khi cô lại) (g)',
  'Hao hụt (g)',
  'Thợ được hao (g)',
  'Phải trả mạt vụn (g)',
  'Chênh lệch mạt (đã trả − phải trả) (g)',
  'Mức hao hụt cho phép (%)',
  'Mức hao hụt thực tế (% trên hàng đạt)',
]

function sumsCells(
  row: {
    qty: number
    inGram: string
    productGram: string
    btpGram: string
    nvlGram: string
    returnedGram: string
    lossGram: string
    lossPercent: string | null
    limitPercent: string | null
    allowedGram: string | null
  },
  scrapGram: string | null,
  bold: boolean,
  due: { dueGram: string | null; balanceGram: string | null } | null,
): XlsxCell[] {
  const gram = bold ? 'boldGram' : 'gram'
  return [
    row.qty,
    { value: num(row.inGram), style: gram },
    { value: num(row.returnedGram), style: gram },
    { value: num(row.productGram), style: gram },
    { value: num(row.btpGram), style: gram },
    { value: num(row.nvlGram), style: gram },
    { value: num(scrapGram), style: gram },
    { value: num(row.lossGram), style: gram },
    { value: num(row.allowedGram), style: gram },
    { value: due ? num(due.dueGram) : null, style: gram },
    { value: due ? num(due.balanceGram) : null, style: gram },
    { value: num(row.limitPercent), style: bold ? 'boldPercent' : 'percent' },
    { value: num(row.lossPercent), style: isOver(row) ? 'warn' : bold ? 'boldPercent' : 'percent' },
  ]
}

/** Các sheet xuất Excel: báo cáo theo tuần (thợ + từng khâu), so sánh tuần, chi tiết phiếu, mạt vụn. */
export function buildLossSheets(report: WeeklyLossReport): XlsxSheet[] {
  const header = (titles: string[]): XlsxCell[] => titles.map((title) => ({ value: title, style: 'bold' }))
  const weekly: XlsxCell[][] = [header(headers(report))]
  for (const row of report.workers) {
    const week = weekLabel(row.week)
    weekly.push([
      { value: week, style: 'bold' },
      { value: row.workerName, style: 'bold' },
      ...sumsCells(row, row.scrapGram, true, row),
    ])
    for (const stage of row.stages) {
      // Không có cột Khâu: dòng khâu ghi tên khâu cạnh tên thợ. Mạt nộp theo thợ nên dòng khâu
      // chỉ có gram được hao.
      weekly.push([week, `${row.workerName} · ${LOSS_STAGE_LABEL[stage.stage]}`, ...sumsCells(stage, null, false, null)])
    }
  }

  const sheets: XlsxSheet[] = [
    { name: 'Báo cáo tuần', rows: weekly, widths: [22, 30, 16, 24, 18, 20, 28, 18, 24, 12, 14, 16, 16, 16, 16] },
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
      `${lossInHeader(report.metal)} (g)`,
      'Trọng lượng hàng trả (sản phẩm) (g)',
      'Trọng lượng bán thành phẩm thu hồi (lưu kho để sử dụng sau) (g)',
      'Trọng lượng NVL thu hồi (g)',
      'Hao hụt (g)',
      'Thợ được hao (g)',
      'Mức hao hụt thực tế (% trên hàng đạt)',
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
      { value: num(item.allowedGram), style: 'gram' },
      { value: num(item.lossPercent), style: 'percent' },
    ])
  }
  sheets.push({ name: 'Chi tiết phiếu', rows: detail, widths: [22, 24, 12, 14, 6, 20, 8, 24, 20, 28, 18, 12, 14, 16] })

  const scraps: XlsxCell[][] = [header(['Tuần', 'Thợ', 'Trọng lượng mạt vụn thu hồi (sau khi cô lại) (g)', 'Thủ kho nhận', 'Lúc nhận', 'Ghi chú'])]
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
  sheets.push({ name: 'Mạt vụn', rows: scraps, widths: [22, 24, 24, 20, 20, 30] })

  const limitRows: XlsxCell[][] = [header(['Khâu', 'Mức hao hụt cho phép (%)'])]
  for (const limit of report.limits) {
    limitRows.push([LOSS_STAGE_LABEL[limit.stage], { value: num(limit.percent), style: 'percent' }])
  }
  sheets.push({ name: 'Mức cho phép', rows: limitRows, widths: [14, 22] })
  return sheets
}
