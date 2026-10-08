import { describe, expect, it } from 'vitest'
import { canReportProductionDefect, Permission } from './permissions'

describe('quyền báo lỗi sản xuất', () => {
  it('thợ không được báo lỗi kể cả được cấp nhầm quyền QC', () => {
    expect(canReportProductionDefect({ roleCode: 'WORKER', permissions: [Permission.PRODUCTION_QC] })).toBe(false)
    expect(canReportProductionDefect({ roleCode: 'USER', extraRoles: ['WORKER'], permissions: [Permission.PRODUCTION_QC] })).toBe(false)
  })

  it('QC và admin được báo lỗi', () => {
    expect(canReportProductionDefect({ roleCode: 'USER', permissions: [Permission.PRODUCTION_QC] })).toBe(true)
    expect(canReportProductionDefect({ roleCode: 'ADMIN' })).toBe(true)
    expect(canReportProductionDefect({ roleCode: 'WORKER', extraRoles: ['ADMIN'] })).toBe(true)
  })

  it('nhân viên khác và người chưa đăng nhập không được báo lỗi', () => {
    expect(canReportProductionDefect({ roleCode: 'USER' })).toBe(false)
    expect(canReportProductionDefect(null)).toBe(false)
  })
})
