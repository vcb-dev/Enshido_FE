import { describe, expect, it } from 'vitest'
import { Permission } from './permissions'
import { SCREEN_GROUPS, firstAllowedPath } from './screens'
import {
  allowedScreensForSave,
  defaultEditScreensForPreset,
  permissionUserForForm,
  screensFromUserForPreset,
} from './staffJobPresets'

const myTickets = SCREEN_GROUPS.find((group) => group.label === 'Phiếu của tôi')!
const menuOf = (key: string) => myTickets.items.find((entry) => entry.key === key)!.menu!

describe('Màn phân quyền khớp sidebar — nhóm "Phiếu của tôi"', () => {
  it('đủ 5 mục theo thứ tự sidebar, đều là ô tích', () => {
    expect(myTickets.items.map((entry) => entry.label)).toEqual([
      'Phiếu khâu',
      'Lệnh đúc',
      'Cấy cây thông',
      'Cắt cây thông',
      'Phiếu QC',
    ])
  })

  it('QC / Thủ kho tích sẵn Phiếu QC / Cắt cây thông, bỏ tích là ẩn menu', () => {
    expect(defaultEditScreensForPreset('kcs')).toContain(Permission.SCREEN_QC_TICKETS)
    expect(defaultEditScreensForPreset('warehouse')).toContain(Permission.SCREEN_CASTING_CUTS)
    const qc = menuOf(Permission.SCREEN_QC_TICKETS)
    expect(qc(permissionUserForForm('kcs', [Permission.SCREEN_QC_TICKETS]))).toBe(true)
    expect(qc(permissionUserForForm('kcs', []))).toBe(false)
    const cuts = menuOf(Permission.SCREEN_CASTING_CUTS)
    expect(cuts(permissionUserForForm('warehouse', [Permission.SCREEN_CASTING_CUTS]))).toBe(true)
    expect(cuts(permissionUserForForm('warehouse', []))).toBe(false)
    const waxTree = menuOf(Permission.SCREEN_WAX_TREE)
    expect(waxTree(permissionUserForForm('worker_wax', [Permission.SCREEN_WAX_TREE]))).toBe(true)
    expect(waxTree(permissionUserForForm('warehouse', []))).toBe(false)
    // Tích cho vai trò khác cũng hiện (chỉ xem — thao tác vẫn theo vai trò).
    expect(qc(permissionUserForForm('accountant', [Permission.SCREEN_QC_TICKETS]))).toBe(true)
  })

  it('Lệnh đúc theo ô tích, không tự mở cho QC; thợ đúc vẫn luôn thấy', () => {
    const casting = menuOf(Permission.SCREEN_CASTING_ORDERS)
    expect(casting(permissionUserForForm('kcs', []))).toBe(false)
    expect(casting(permissionUserForForm('kcs', [Permission.SCREEN_CASTING_ORDERS]))).toBe(true)
    expect(casting(permissionUserForForm('worker_casting', []))).toBe(true)
  })

  it('đã bỏ tích Phiếu QC thì mở form sửa không tự tích lại', () => {
    const saved = allowedScreensForSave('kcs', [Permission.SCREEN_DASHBOARD])
    expect(saved).not.toContain(Permission.SCREEN_QC_TICKETS)
    expect(screensFromUserForPreset({ roleCode: 'USER', allowedScreens: saved }, 'kcs')).not.toContain(
      Permission.SCREEN_QC_TICKETS,
    )
  })

  it('QC bị bỏ tích Phiếu QC không bị đưa vào /qc-tickets (tránh vòng chuyển trang)', () => {
    const user = { roleCode: 'USER', permissions: [Permission.PRODUCTION_QC, Permission.SCREEN_DASHBOARD] }
    expect(firstAllowedPath(user)).not.toBe('/qc-tickets')
    expect(firstAllowedPath({ ...user, permissions: [...user.permissions, Permission.SCREEN_QC_TICKETS] })).toBe(
      '/qc-tickets',
    )
  })
})
