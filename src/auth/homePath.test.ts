import { describe, expect, it } from 'vitest'
import { canAccessPath, homePathForUser } from './homePath'
import { isWorkerOnly, Permission, type PermissionUser } from './permissions'

const admin: PermissionUser = { roleCode: 'ADMIN' }
const worker: PermissionUser = {
  roleCode: 'WORKER',
  permissions: [Permission.PRODUCTION_WORKER],
}
const staff: PermissionUser = {
  roleCode: 'USER',
  permissions: [Permission.SCREEN_DASHBOARD, Permission.SCREEN_WAREHOUSE_NVL_CHINH],
}
const stockKeeper: PermissionUser = {
  roleCode: 'USER',
  permissions: [Permission.SCREEN_WAREHOUSE_THANH_PHAM],
}

describe('isWorkerOnly — khớp với bản ở backend', () => {
  it('đúng với tài khoản chỉ làm thợ', () => {
    expect(isWorkerOnly(worker)).toBe(true)
  })

  it('sai với nhân viên, admin và khi chưa đăng nhập', () => {
    expect(isWorkerOnly(staff)).toBe(false)
    expect(isWorkerOnly(admin)).toBe(false)
    expect(isWorkerOnly(null)).toBe(false)
    expect(isWorkerOnly(undefined)).toBe(false)
  })

  it('thợ kiêm admin thì KHÔNG bị chặn', () => {
    expect(isWorkerOnly({ roleCode: 'WORKER', extraRoles: ['ADMIN'] })).toBe(false)
  })
})

describe('canAccessPath — thợ không có màn quản lý đơn', () => {
  it('chặn danh sách đơn', () => {
    expect(canAccessPath(worker, '/orders')).toBe(false)
    expect(canAccessPath(admin, '/orders')).toBe(true)
    expect(canAccessPath(staff, '/orders')).toBe(true)
  })

  it('vẫn cho mở /orders/:code — rơi vào trang tham khảo chỉ-đọc', () => {
    // QR trên phiếu mẹ đã in trỏ vào đây, chặn cứng là thợ quét ra trang trắng.
    expect(canAccessPath(worker, '/orders/A012')).toBe(true)
  })

  it('chặn trang in', () => {
    expect(canAccessPath(worker, '/orders/A012/print')).toBe(false)
    expect(canAccessPath(admin, '/orders/A012/print')).toBe(true)
  })

  // Kho thành phẩm giờ là một kho — mở theo quyền kho, thợ vẫn bị chặn.
  it('chặn kho thành phẩm', () => {
    expect(canAccessPath(worker, '/finished-goods')).toBe(false)
    expect(canAccessPath(staff, '/finished-goods')).toBe(false)
    expect(canAccessPath(stockKeeper, '/finished-goods')).toBe(true)
    expect(canAccessPath(admin, '/finished-goods')).toBe(true)
  })

  it('cho mở phiếu con và màn Phiếu của tôi', () => {
    expect(canAccessPath(worker, '/tickets/A012-1')).toBe(true)
    expect(canAccessPath(worker, '/my-tickets')).toBe(true)
  })

  it('nhân viên không có quyền Thợ thì không vào Phiếu của tôi', () => {
    expect(canAccessPath(staff, '/my-tickets')).toBe(false)
  })

  it('chặn màn Nhân sự và Cấu hình với thợ', () => {
    expect(canAccessPath(worker, '/users')).toBe(false)
    expect(canAccessPath(worker, '/settings/locations')).toBe(false)
  })

  it('bỏ qua query và dấu / thừa ở cuối', () => {
    expect(canAccessPath(worker, '/orders?tab=production')).toBe(false)
    expect(canAccessPath(worker, '/orders/')).toBe(false)
    expect(canAccessPath(worker, '/my-tickets?x=1')).toBe(true)
  })
})

describe('homePathForUser', () => {
  it('thợ vào thẳng phần việc của mình', () => {
    expect(homePathForUser(worker)).toBe('/my-tickets')
  })

  it('thợ được tick thêm màn hình khác vẫn vào Phiếu của tôi', () => {
    const kiemNhiem: PermissionUser = {
      roleCode: 'WORKER',
      permissions: [Permission.PRODUCTION_WORKER, Permission.SCREEN_DASHBOARD],
    }
    expect(homePathForUser(kiemNhiem)).toBe('/my-tickets')
  })

  it('admin và nhân viên có Tổng quan thì vào Tổng quan', () => {
    expect(homePathForUser(admin)).toBe('/')
    expect(homePathForUser(staff)).toBe('/')
  })
})
