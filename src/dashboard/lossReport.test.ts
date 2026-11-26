import { describe, expect, it } from 'vitest'
import type { WeeklyLossReport } from '../api/lossReports'
import { buildLossSheets, filterLossReport, isOver, lossWorkers, weekLabel, weekStart } from './lossReport'
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
  allowedGram: '19.2',
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
      dueGram: '15.8',
      balanceGram: '14.2',
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
    // Không có cột Khâu: 12 cột theo tab BÁO CÁO + 3 cột mạt; dòng khâu ghi tên khâu cạnh tên thợ.
    expect(header).toHaveLength(15)
    expect(String(stage[1])).toContain(' · ')
    expect(total[8]).toEqual({ value: 30, style: 'boldGram' })
    // Được hao / phải trả / chênh lệch lấy nguyên số BE; dòng khâu không có phần mạt.
    expect(total.slice(10, 13)).toEqual([
      { value: 19.2, style: 'boldGram' },
      { value: 15.8, style: 'boldGram' },
      { value: 14.2, style: 'boldGram' },
    ])
    expect(stage.slice(10, 13)).toEqual([
      { value: 19.2, style: 'gram' },
      { value: null, style: 'gram' },
      { value: null, style: 'gram' },
    ])
    expect(stage[14]).toEqual({ value: 9.33, style: 'warn' })
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


describe('lọc báo cáo theo khâu / thợ', () => {
  const multi: WeeklyLossReport = {
    ...report,
    weeks: [report.weeks[1]],
    workers: [
      report.workers[0],
      {
        ...report.workers[0],
        workerKey: 'b',
        workerUserId: 'b',
        workerName: 'Thợ B',
        stages: [{ stage: 'POLISHING', ...sums }],
      },
    ],
    items: [
      { week: '2026-10-19', workerKey: 'a', stage: 'FILING', ticketCode: 'P1', attempt: 1, confirmedAt: '2026-10-20T03:00:00Z', ...sums },
      { week: '2026-10-19', workerKey: 'b', stage: 'POLISHING', ticketCode: 'P2', attempt: 1, confirmedAt: '2026-10-20T03:00:00Z', ...sums },
    ],
    scrapReturns: [
      { id: 's1', week: '2026-10-19', workerKey: 'a', workerName: 'Thợ A', weightGram: '30', note: null, receivedAt: '2026-10-25T03:00:00Z', receivedByName: 'Kho' },
      { id: 's2', week: '2026-10-19', workerKey: 'b', workerName: 'Thợ B', weightGram: '30', note: null, receivedAt: '2026-10-25T03:00:00Z', receivedByName: 'Kho' },
    ],
  }

  it('không lọc thì trả nguyên báo cáo', () => {
    expect(filterLossReport(multi, { stage: '', workerKey: '' })).toBe(multi)
  })

  it('lọc khâu: dòng thợ lấy số của khâu, bỏ thợ không làm khâu, cột mạt để trống', () => {
    const out = filterLossReport(multi, { stage: 'FILING', workerKey: '' })
    expect(out.workers).toHaveLength(1)
    const row = out.workers[0]
    expect(row.workerName).toBe('Thợ A')
    expect(row.lossGram).toBe('35')
    expect(row.lossPercent).toBe('9.33')
    expect(row.scrapGram).toBeNull()
    expect(row.dueGram).toBeNull()
    expect(row.balanceGram).toBeNull()
    expect(out.items.map((item) => item.ticketCode)).toEqual(['P1'])
    expect(out.scrapReturns.map((scrap) => scrap.id)).toEqual(['s1'])
  })

  it('lọc thợ: giữ nguyên dòng tổng của thợ đó', () => {
    const out = filterLossReport(multi, { stage: '', workerKey: 'b' })
    expect(out.workers).toEqual([multi.workers[1]])
    expect(out.items.map((item) => item.ticketCode)).toEqual(['P2'])
    expect(out.scrapReturns.map((scrap) => scrap.id)).toEqual(['s2'])
  })

  it('lọc cả hai không khớp thì rỗng', () => {
    const out = filterLossReport(multi, { stage: 'POLISHING', workerKey: 'a' })
    expect(out.workers).toEqual([])
    expect(out.items).toEqual([])
  })

  it('danh sách thợ theo tên, không trùng', () => {
    expect(lossWorkers({ ...multi, workers: [...multi.workers, multi.workers[0]] })).toEqual([
      { key: 'a', name: 'Thợ A' },
      { key: 'b', name: 'Thợ B' },
    ])
  })

  it('Excel khi lọc khâu: không lặp dòng khâu, tên thợ kèm khâu', () => {
    const sheet = buildLossSheets(filterLossReport(multi, { stage: 'FILING', workerKey: '' }), 'FILING')[0]
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.rows[1][1]).toEqual({ value: 'Thợ A · Nguội', style: 'bold' })
  })
})
