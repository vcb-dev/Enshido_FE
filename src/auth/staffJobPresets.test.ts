import { describe, expect, it } from 'vitest'
import { Permission } from './permissions'
import {
  allowedScreensForSave,
  inferStaffJobPreset,
  staffJobPresetForEditForm,
  staffJobSelectOptions,
  workerStagesForPreset,
} from './staffJobPresets'

describe('vai trò ở màn Nhân sự', () => {
  it('chọn được Thợ sản xuất, mở form sửa thợ cũ không bị đổi sang QC', () => {
    expect(staffJobSelectOptions().map((o) => o.value)).toContain('worker_sx')
    const worker = { roleCode: 'WORKER' as const, allowedScreens: [Permission.SCREEN_MY_TICKETS] }
    expect(staffJobPresetForEditForm(inferStaffJobPreset(worker))).toBe('worker_sx')
  })

  it('chọn được Thợ nguội và lưu khâu Nguội', () => {
    expect(staffJobSelectOptions().map((o) => o.value)).toContain('worker_filing')
    expect(workerStagesForPreset('worker_filing')).toEqual(['FILING'])
    const filing = {
      roleCode: 'WORKER' as const,
      allowedScreens: [Permission.SCREEN_MY_TICKETS],
      workerStages: ['FILING' as const],
    }
    expect(inferStaffJobPreset(filing)).toBe('worker_filing')
    expect(
      allowedScreensForSave('worker_filing', []).includes(Permission.SCREEN_MY_TICKETS),
    ).toBe(true)
  })

  it('thủ kho lưu kèm quyền tạo đơn và duyệt đơn', () => {
    const saved = allowedScreensForSave('warehouse', [Permission.SCREEN_WAREHOUSE_NVL_CHINH])
    expect(saved).toContain(Permission.INTAKE_CREATE)
    expect(saved).toContain(Permission.INTAKE_APPROVE)
    expect(saved).toContain(Permission.WAREHOUSE_KEEPER)
  })
})
