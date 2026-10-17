import { describe, expect, it } from 'vitest'
import { Permission, type PermissionCode } from './permissions'
import {
  allowedScreensForSave,
  defaultEditScreensForPreset,
  extraJobOptions,
  inferStaffJobPreset,
  inferStaffJobPresets,
  jobPresetsOf,
  permissionUserForForm,
  roleAndScreensForPreset,
  roleCodeForPresets,
  screensAfterPresetChange,
  screensFromUserForPreset,
  staffJobLabel,
  staffJobPresetForEditForm,
  staffJobSelectOptions,
  workerStagesForSave,
  type StaffJobPreset,
} from './staffJobPresets'
import type { StageCode } from '../api/productionOrders'

describe('vai trò ở màn Nhân sự', () => {
  it('5 vai trò thợ lệnh SX chọn được; vai trò chính + vai trò thêm lưu đủ khâu', () => {
    const values = staffJobSelectOptions().map((o) => o.value)
    for (const role of ['worker_filing', 'worker_stone', 'worker_engrave', 'worker_polish', 'worker_plate']) {
      expect(values).toContain(role)
    }
    // Thợ đánh bóng + thêm Thợ xi; ô thêm trùng vai trò chính hoặc chưa chọn bị bỏ.
    const presets = jobPresetsOf('worker_polish', ['worker_plate', 'worker_polish', ''])
    expect(presets).toEqual(['worker_polish', 'worker_plate'])
    const stages = workerStagesForSave(presets)
    expect(stages).toEqual(['POLISHING', 'PLATING'])
    const saved = allowedScreensForSave(presets, [])
    expect(saved).toEqual(
      expect.arrayContaining([Permission.SCREEN_MY_TICKETS, Permission.PRODUCTION_WORKER]),
    )
    const user = { roleCode: roleCodeForPresets(presets), allowedScreens: saved, workerStages: stages }
    expect(user.roleCode).toBe('WORKER')
    const [primary, ...rest] = inferStaffJobPresets(user)
    expect(staffJobPresetForEditForm(primary)).toBe('worker_polish')
    expect(rest).toEqual(['worker_plate'])
    expect(staffJobLabel(user)).toBe('Thợ đánh bóng + Thợ xi')
  })

  it('một khâu thì nhãn là tên thợ khâu đó; thợ cũ cả 5 khâu mở ra là Thợ nguội + 4 vai trò thêm', () => {
    expect(staffJobLabel({ roleCode: 'WORKER', allowedScreens: [], workerStages: ['FILING'] })).toBe(
      'Thợ nguội',
    )
    const legacy = {
      roleCode: 'WORKER' as const,
      allowedScreens: [],
      workerStages: ['FILING', 'STONE_SETTING', 'ENGRAVING', 'POLISHING', 'PLATING'] as StageCode[],
    }
    expect(inferStaffJobPreset(legacy)).toBe('worker_filing')
    expect(inferStaffJobPresets(legacy).slice(1)).toEqual([
      'worker_stone',
      'worker_engrave',
      'worker_polish',
      'worker_plate',
    ])
  })

  it('vai trò không phải thợ khâu thì không có khâu; kiêm thợ khâu thì có', () => {
    expect(workerStagesForSave('kcs')).toEqual([])
    expect(workerStagesForSave('worker_casting')).toEqual([])
    expect(workerStagesForSave(['kcs', 'worker_filing'])).toEqual(['FILING'])
  })

  it('VCB chỉ tạo đơn, không duyệt, không vào kho', () => {
    expect(staffJobSelectOptions().map((o) => o.value)).toContain('vcb')
    const saved = allowedScreensForSave('vcb', defaultEditScreensForPreset('vcb'))
    expect(saved).toEqual(
      expect.arrayContaining([Permission.SCREEN_INTAKE_ORDERS, Permission.INTAKE_CREATE]),
    )
    expect(saved).toContain(Permission.CUSTOMER)
    expect(saved).not.toContain(Permission.INTAKE_APPROVE)
    // Đổi từ Thủ kho sang VCB thì không giữ lại màn kho đã tick.
    expect(allowedScreensForSave('vcb', [Permission.SCREEN_WAREHOUSE_NVL_CHINH])).not.toContain(
      Permission.SCREEN_WAREHOUSE_NVL_CHINH,
    )
    expect(saved).not.toContain(Permission.WAREHOUSE_KEEPER)
    expect(roleAndScreensForPreset('vcb').roleCode).toBe('USER')
    expect(inferStaffJobPreset({ roleCode: 'USER', allowedScreens: saved })).toBe('vcb')
  })

  it('thủ kho lưu kèm quyền tạo đơn và duyệt đơn', () => {
    const saved = allowedScreensForSave('warehouse', [Permission.SCREEN_WAREHOUSE_NVL_CHINH])
    expect(saved).toContain(Permission.INTAKE_CREATE)
    expect(saved).toContain(Permission.INTAKE_APPROVE)
    expect(saved).toContain(Permission.WAREHOUSE_KEEPER)
  })

  it('kế toán lưu kèm quyền xác nhận phiếu xuất, mở lại vẫn là Kế toán', () => {
    expect(staffJobSelectOptions().map((o) => o.value)).toContain('accountant')
    const saved = allowedScreensForSave('accountant', [Permission.SCREEN_WAREHOUSE_THANH_PHAM])
    expect(saved).toContain(Permission.ACCOUNTING_APPROVE)
    expect(saved).not.toContain(Permission.WAREHOUSE_KEEPER)
    expect(inferStaffJobPreset({ roleCode: 'USER', allowedScreens: saved })).toBe('accountant')
  })

  it('kế toán kiêm thủ kho vẫn mở lại đủ hai vai trò', () => {
    const presets = ['warehouse', 'accountant'] as StaffJobPreset[]
    const saved = allowedScreensForSave(presets, [])
    expect(saved).toEqual(
      expect.arrayContaining([Permission.WAREHOUSE_KEEPER, Permission.ACCOUNTING_APPROVE]),
    )
    expect(inferStaffJobPresets({ roleCode: roleCodeForPresets(presets), allowedScreens: saved })).toEqual(presets)
  })
})

describe('một tài khoản kiêm nhiều vai trò', () => {
  const roundTrip = (presets: StaffJobPreset[], picked: PermissionCode[] = []) => {
    const allowedScreens = allowedScreensForSave(presets, picked)
    const user = {
      roleCode: roleCodeForPresets(presets),
      allowedScreens,
      workerStages: workerStagesForSave(presets),
    }
    return { user, inferred: inferStaffJobPresets(user), label: staffJobLabel(user) }
  }

  it('Thủ kho + QC + Kế toán: role Nhân viên, lưu đủ quyền, mở lại đủ ba vai trò', () => {
    const { user, inferred, label } = roundTrip(['warehouse', 'kcs', 'accountant'])
    expect(user.roleCode).toBe('USER')
    expect(user.allowedScreens).toEqual(
      expect.arrayContaining([
        Permission.WAREHOUSE_KEEPER,
        Permission.PRODUCTION_QC,
        Permission.ACCOUNTING_APPROVE,
      ]),
    )
    expect(inferred).toEqual(['warehouse', 'kcs', 'accountant'])
    expect(label).toBe('Thủ kho + QC + Kế toán')
  })

  it('QC kiêm Thợ nguội: role Nhân viên (không bị chặn như thợ), vẫn có khâu và màn Phiếu của tôi', () => {
    const { user, inferred, label } = roundTrip(['kcs', 'worker_filing'])
    expect(user.roleCode).toBe('USER')
    expect(user.workerStages).toEqual(['FILING'])
    expect(user.allowedScreens).toEqual(
      expect.arrayContaining([
        Permission.PRODUCTION_QC,
        Permission.PRODUCTION_WORKER,
        Permission.SCREEN_MY_TICKETS,
      ]),
    )
    expect(inferred).toEqual(['worker_filing', 'kcs'])
    expect(label).toBe('Thợ nguội + QC')
  })

  it('toàn vai trò thợ (3D, đúc, thợ khâu) vẫn là role Thợ', () => {
    const { user, inferred } = roundTrip(['worker_3d', 'worker_casting', 'worker_plate'])
    expect(user.roleCode).toBe('WORKER')
    expect(inferred).toEqual(['worker_3d', 'worker_casting', 'worker_plate'])
  })

  it('Admin kiêm Thợ xi và Thợ đúc: vẫn Admin, lưu khâu + quyền việc, không lưu màn hình', () => {
    const presets = ['admin', 'worker_casting', 'worker_plate'] as StaffJobPreset[]
    const { user, inferred, label } = roundTrip(presets, [Permission.SCREEN_WAREHOUSE_BTP])
    expect(user.roleCode).toBe('ADMIN')
    expect(user.workerStages).toEqual(['PLATING'])
    expect(user.allowedScreens).toEqual(
      expect.arrayContaining([Permission.PRODUCTION_CAST, Permission.PRODUCTION_WORKER]),
    )
    // Admin có mọi màn: màn tích tay không được lưu.
    expect(user.allowedScreens).not.toContain(Permission.SCREEN_WAREHOUSE_BTP)
    expect(inferred).toEqual(['admin', 'worker_casting', 'worker_plate'])
    expect(label).toBe('Admin + Thợ đúc + Thợ xi')
    expect(roundTrip(['admin']).label).toBe('Admin')
  })

  it('VCB đứng một mình: ô thêm bị bỏ, không chọn thêm được', () => {
    expect(jobPresetsOf('vcb', ['warehouse', 'worker_filing'])).toEqual(['vcb'])
    expect(extraJobOptions(['kcs']).map((o) => o.value)).not.toContain('vcb')
    expect(extraJobOptions(['kcs']).map((o) => o.value)).not.toContain('kcs')
    expect(extraJobOptions(['kcs']).map((o) => o.value)).toContain('admin')
  })

  it('màn mặc định của mọi vai trò gộp lại; đổi vai trò thì thêm / bỏ đúng phần của vai trò đó', () => {
    const both = defaultEditScreensForPreset(['warehouse', 'kcs'])
    expect(both).toEqual(
      expect.arrayContaining([Permission.SCREEN_WAREHOUSE_NVL_CHINH, Permission.SCREEN_QC_TICKETS, Permission.SCREEN_DASHBOARD]),
    )
    // Thêm Thủ kho vào QC: giữ màn QC đã tích, thêm màn kho.
    const added = screensAfterPresetChange(defaultEditScreensForPreset('kcs'), ['kcs'], ['kcs', 'warehouse'])
    expect(added).toEqual(expect.arrayContaining([Permission.SCREEN_QC_TICKETS, Permission.SCREEN_WAREHOUSE_BTP]))
    // Bỏ Thủ kho: màn kho đi theo, màn QC ở lại.
    const removed = screensAfterPresetChange(both, ['kcs', 'warehouse'], ['kcs'])
    expect(removed).not.toContain(Permission.SCREEN_WAREHOUSE_BTP)
    expect(removed).toContain(Permission.SCREEN_QC_TICKETS)
  })

  it('đã bỏ tích Phiếu QC thì thêm vai trò khác không tích lại; màn tích tay vẫn còn', () => {
    const current = [Permission.SCREEN_DASHBOARD, Permission.SCREEN_LOCATIONS]
    const next = screensAfterPresetChange(current, ['kcs'], ['kcs', 'worker_filing'])
    expect(next).not.toContain(Permission.SCREEN_QC_TICKETS)
    expect(next).toContain(Permission.SCREEN_LOCATIONS)
    expect(next).toContain(Permission.SCREEN_MY_TICKETS)
  })

  it('mở form sửa tài khoản kiêm nhiều vai trò: màn hình gộp đủ, không tự tích lại màn đã bỏ', () => {
    const presets = ['kcs', 'worker_filing'] as StaffJobPreset[]
    const allowedScreens = allowedScreensForSave(presets, [Permission.SCREEN_DASHBOARD])
    const screens = screensFromUserForPreset({ roleCode: 'USER', allowedScreens }, presets)
    expect(screens).toContain(Permission.SCREEN_MY_TICKETS)
    expect(screens).not.toContain(Permission.SCREEN_QC_TICKETS)
  })

  it('menu theo ô tích: QC kiêm Thợ nguội thấy Phiếu khâu, không thấy Cắt cây thông', () => {
    const account = permissionUserForForm(['kcs', 'worker_filing'], [Permission.SCREEN_QC_TICKETS])
    expect(account.roleCode).toBe('USER')
    expect(account.permissions).toEqual(
      expect.arrayContaining([Permission.SCREEN_MY_TICKETS, Permission.SCREEN_QC_TICKETS]),
    )
    expect(account.permissions).not.toContain(Permission.SCREEN_CASTING_CUTS)
  })
})
