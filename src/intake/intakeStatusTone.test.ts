import { describe, expect, it } from 'vitest'
import { intakeStatusTone } from './intakeStatusTone'

describe('intakeStatusTone — nhãn trạng thái ở màn Tạo đơn', () => {
  it('trạng thái luồng tạo đơn giữ nhãn riêng', () => {
    expect(intakeStatusTone('READY_FOR_PRODUCTION').label).toBe('Chờ SX · Đã có 3D')
  })

  it('đơn chưa cắt cây bị đổi sang Sửa 3D / Sản xuất lỗi lấy nhãn lệnh SX, không sập', () => {
    expect(intakeStatusTone('REDO_3D').label).toBe('Sửa 3D')
    expect(intakeStatusTone('DEFECT').label).toBe('Sản xuất lỗi')
  })

  it('mã lạ (BE thêm trạng thái mới) vẫn hiện được mã', () => {
    expect(intakeStatusTone('SOMETHING_NEW').label).toBe('SOMETHING_NEW')
  })
})
