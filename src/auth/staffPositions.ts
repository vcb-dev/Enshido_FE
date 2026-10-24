/** Bộ phận chọn từ danh sách; dữ liệu cũ gõ tự do vẫn hiện nguyên (xem `departmentOptions`). */
export const DEPARTMENTS = ['Sản xuất', 'Văn phòng', 'Kho'] as const

/**
 * Vị trí công việc — chỉ để hiển thị, không đổi quyền (quyền theo Vai trò). Cùng mã với
 * `STAFF_POSITIONS` ở BE.
 */
export const POSITION_OPTIONS = [
  { value: 'accountant', label: 'Kế toán' },
  { value: 'warehouse_keeper', label: 'Thủ kho' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'qc', label: 'QC' },
  { value: 'kcs', label: 'KCS' },
  { value: 'worker_3d', label: 'Thợ 3D' },
  { value: 'worker_wax', label: 'Thợ sáp' },
  { value: 'worker_casting', label: 'Thợ đúc' },
  { value: 'worker_filing', label: 'Thợ nguội' },
  { value: 'worker_stone', label: 'Thợ vào đá' },
  { value: 'worker_engrave', label: 'Thợ khắc' },
  { value: 'worker_polish', label: 'Thợ đánh bóng' },
  { value: 'worker_plate', label: 'Thợ xi' },
] as const

export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const

export function positionLabel(position: string | null | undefined) {
  return POSITION_OPTIONS.find((option) => option.value === position)?.label ?? ''
}

/** Chỉ vị trí thợ mới có bậc tay nghề. */
export function isWorkerPosition(position: string | null | undefined) {
  return position != null && position.startsWith('worker_')
}

/** Danh sách bộ phận cho ô chọn; giữ giá trị cũ gõ tự do của nhân sự đang sửa. */
export function departmentOptions(current: string | null | undefined) {
  const list: string[] = [...DEPARTMENTS]
  const value = current?.trim()
  if (value && !list.includes(value)) list.push(value)
  return list.map((name) => ({ value: name, label: name }))
}
