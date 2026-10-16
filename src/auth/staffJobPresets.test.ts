import { describe, expect, it } from 'vitest'
import { Permission } from './permissions'
import {
  allowedScreensForSave,
  defaultEditScreensForPreset,
  inferStaffJobPreset,
  roleAndScreensForPreset,
  staffJobPresetForEditForm,
  extraStageRolesOf,
  staffJobLabel,
  staffJobSelectOptions,
  workerStagesForSave,
} from './staffJobPresets'
import type { StageCode } from '../api/productionOrders'

describe('vai trò ở màn Nhân sự', () => {
  it('5 vai trò thợ lệnh SX chọn được; vai trò chính + vai trò thêm lưu đủ khâu', () => {
    const values = staffJobSelectOptions().map((o) => o.value)
    for (const role of ['worker_filing', 'worker_stone', 'worker_engrave', 'worker_polish', 'worker_plate']) {
      expect(values).toContain(role)
    }
    // Thợ đánh bóng + thêm Thợ xi; ô thêm trùng vai trò chính hoặc chưa chọn bị bỏ.
    const stages = workerStagesForSave('worker_polish', ['worker_plate', 'worker_polish', ''])
    expect(stages).toEqual(['POLISHING', 'PLATING'])
    const saved = allowedScreensForSave('worker_polish', [])
    expect(saved).toEqual(
      expect.arrayContaining([Permission.SCREEN_MY_TICKETS, Permission.PRODUCTION_WORKER]),
    )
    const user = { roleCode: 'WORKER' as const, allowedScreens: saved, workerStages: stages }
    const preset = staffJobPresetForEditForm(inferStaffJobPreset(user))
    expect(preset).toBe('worker_polish')
    expect(extraStageRolesOf(user, preset)).toEqual(['worker_plate'])
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
    const preset = inferStaffJobPreset(legacy)
    expect(preset).toBe('worker_filing')
    expect(extraStageRolesOf(legacy, preset)).toEqual([
      'worker_stone',
      'worker_engrave',
      'worker_polish',
      'worker_plate',
    ])
  })

  it('vai trò ngoài lệnh sản xuất không lưu khâu, không có vai trò thêm', () => {
    expect(workerStagesForSave('kcs', ['worker_filing'])).toEqual([])
    expect(workerStagesForSave('worker_casting', ['worker_filing'])).toEqual([])
    expect(extraStageRolesOf({ workerStages: ['FILING'] }, 'warehouse')).toEqual([])
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
})
