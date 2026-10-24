import { describe, expect, it } from 'vitest'
import type { WeeklyLossReport } from '../api/lossReports'
import { buildLossSheets, isOver, weekLabel, weekStart } from './lossReport'
import { buildXlsx, columnName, crc32 } from './xlsx'

const sums = {
  tickets: 1,
  qty: 20,
  inGram: '375',
  productGram: '320',
  btpGram: '10',
  nvlGram: '10',
  returnedGram: '370',
  lossGram: '5',
  lossPercent: '1.33',
  limitPercent: '6',
}

const report: WeeklyLossReport = {
  weeks: [
    { start: '2026-10-12', end: '2026-10-18' },
    { start: '2026-10-19', end: '2026-10-25' },
  ],
  metal: 'SILVER',
  pendingCount: 0,
  limits: [{ stage: 'FILING', percent: '6' }],
  workers: [
    {
      week: '2026-10-19',
      workerKey: 'a',
      workerUserId: 'a',
      workerName: 'Thợ A',
      ...sums,
      scrapGram: '30',
      stages: [{ stage: 'FILING', ...sums, returnedGram: '340', lossGram: '35', lossPercent: '9.33' }],
    },
  ],
  items: [],
  scrapReturns: [],
}

describe('tuần báo cáo', () => {
  it('lùi về thứ Hai', () => {
    expect(weekStart('2026-10-22')).toBe('2026-10-19')
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
  })

  it('nhãn tuần, qua năm thì ghi cả năm đầu', () => {
    expect(weekLabel('2026-10-19')).toBe('19/10 – 25/10/2026')
    expect(weekLabel('2026-12-28')).toBe('28/12/2026 – 03/01/2027')
  })

  it('vượt mức chỉ khi có cả hai số', () => {
    expect(isOver({ lossPercent: '6.01', limitPercent: '6' })).toBe(true)
    expect(isOver({ lossPercent: '6', limitPercent: '6' })).toBe(false)
    expect(isOver({ lossPercent: '9', limitPercent: null })).toBe(false)
  })
})

describe('xuất Excel', () => {
  it('đủ sheet; dòng tổng của thợ có mạt, dòng khâu vượt mức tô đỏ', () => {
    const sheets = buildLossSheets(report)
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      'Báo cáo tuần',
      'So sánh tuần',
      'Chi tiết phiếu',
      'Mạt vụn',
      'Mức cho phép',
    ])
    const [header, total, stage] = sheets[0].rows
    expect(header).toHaveLength(14)
    expect(total[2]).toEqual({ value: 'Tổng', style: 'bold' })
    expect(total[9]).toEqual({ value: 30, style: 'boldGram' })
    expect(stage[13]).toEqual({ value: 9.33, style: 'warn' })
    // So sánh: tuần thợ không có việc để trống.
    expect(sheets[1].rows[1].slice(1, 3)).toEqual([null, null])
  })

  it('một tuần thì không có sheet so sánh', () => {
    const sheets = buildLossSheets({ ...report, weeks: [report.weeks[1]] })
    expect(sheets.map((sheet) => sheet.name)).not.toContain('So sánh tuần')
  })

  it('tên cột Excel', () => {
    expect(columnName(0)).toBe('A')
    expect(columnName(25)).toBe('Z')
    expect(columnName(26)).toBe('AA')
  })

  it('crc32 chuẩn và file bắt đầu bằng chữ ký zip', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    const bytes = buildXlsx(buildLossSheets(report))
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})
