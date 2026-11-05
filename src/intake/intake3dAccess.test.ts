import { describe, expect, it } from 'vitest'
import { canAccessPath, homePathForUser } from '../auth/homePath'
import { permissionUserForForm } from '../auth/staffJobPresets'
import {
  canAccessProductionOrdersPage,
  canInjectWax,
  canUseMyTickets,
  canUseQcTickets,
  isIntake3dScoped,
  isIntakeWaxScoped,
} from './intake3dAccess'

const account = (...presets: Parameters<typeof permissionUserForForm>[0][]) =>
  permissionUserForForm(presets.flat(), [])

describe('thợ 3D / sáp kiêm việc khác', () => {
  it('thợ 3D / sáp thuần vẫn bị giới hạn: vào Lệnh SX, không có Phiếu của tôi', () => {
    for (const user of [account('worker_3d'), account('worker_wax'), account('worker_3d', 'worker_wax')]) {
      expect(isIntake3dScoped(user) || isIntakeWaxScoped(user)).toBe(true)
      expect(canAccessProductionOrdersPage(user)).toBe(true)
      expect(canUseMyTickets(user)).toBe(false)
    }
  })

  it('thợ 3D kiêm Thợ nguội: hết bị giới hạn, có Phiếu của tôi và vẫn vào Lệnh SX', () => {
    const user = account('worker_3d', 'worker_filing')
    expect(isIntake3dScoped(user)).toBe(false)
    expect(canUseMyTickets(user)).toBe(true)
    expect(canAccessProductionOrdersPage(user)).toBe(true)
  })

  it('thợ sáp kiêm Thợ đúc / Thủ kho / QC / Kế toán: không bị giới hạn', () => {
    for (const other of ['worker_casting', 'warehouse', 'kcs', 'accountant'] as const) {
      const user = account('worker_wax', other)
      expect(isIntakeWaxScoped(user)).toBe(false)
      expect(canAccessProductionOrdersPage(user)).toBe(true)
    }
  })

  it('thợ 3D kiêm QC: thấy Phiếu QC khi được tích', () => {
    const user = permissionUserForForm(['worker_3d', 'kcs'], ['screen.qc-tickets'])
    expect(canUseQcTickets(user)).toBe(true)
    expect(canUseMyTickets(user)).toBe(false)
  })
})

describe('thợ đúc bơm sáp', () => {
  it('thợ đúc vào Lệnh SX để bơm sáp, trang chủ vẫn là Lệnh đúc', () => {
    const user = account('worker_casting')
    expect(canInjectWax(user)).toBe(true)
    expect(canAccessProductionOrdersPage(user)).toBe(true)
    expect(canAccessPath(user, '/orders')).toBe(true)
    expect(homePathForUser(user)).toBe('/casting')
  })

  it('thợ sáp vẫn bơm sáp; thợ 3D thì không', () => {
    expect(canInjectWax(account('worker_wax'))).toBe(true)
    expect(canInjectWax(account('worker_3d'))).toBe(false)
  })
})
