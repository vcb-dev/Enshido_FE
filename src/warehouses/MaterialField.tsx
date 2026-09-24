import type { Control } from 'react-hook-form'
import { useController } from 'react-hook-form'
import {
  matchStockMaterial,
  MaterialNameField,
  type StockMaterialOption,
} from './MaterialNameField'

/**
 * Trường "Tên hàng" nối react-hook-form, dùng chung cho phiếu nhập/xuất.
 * Bắt buộc chọn từ danh mục khi tạo mới; sửa chỉ đổi ghi chú hiển thị.
 *
 * Chỉ cần `control` (không cần biết kiểu form cụ thể) vì các field liên đới —
 * mã hàng, đơn vị, vị trí kệ... — khác nhau giữa nhập và xuất; panel gọi tự
 * quyết định set gì trong `onSelect`.
 */
export function MaterialField({
  control,
  name = 'name',
  kind,
  readOnly,
  materials,
  loading,
  noun,
  nameLabel,
  createLabel,
  allowCreate,
  onSelect,
}: {
  control: Control<any>
  /** Đường dẫn RHF — `name` hoặc `lines.0.name` khi nhập nhiều dòng. */
  name?: string
  kind: 'create' | 'edit' | 'view'
  readOnly: boolean
  materials: StockMaterialOption[]
  loading?: boolean
  noun?: string
  nameLabel?: string
  createLabel?: string
  allowCreate?: boolean
  onSelect: (material: StockMaterialOption | null) => void
}) {
  const fieldLabel = nameLabel ?? (noun ? `Tên ${noun}` : 'Tên NVL')
  const materialIdName = name.replace(/name$/, 'materialId')
  const { field, fieldState } = useController({
    name,
    control,
    rules: {
      required: allowCreate ? `${fieldLabel} không được trống` : `Chọn ${fieldLabel} từ Tồn`,
      validate: (value, formValues: Record<string, unknown>) => {
        if (allowCreate || kind !== 'create' || loading) return true
        const name = String(value ?? '').trim()
        if (!name) return true
        if (readPath(formValues, materialIdName)) return true
        if (matchStockMaterial(materials, name)) return true
        return `Chọn ${fieldLabel} từ danh sách, không nhập tự do`
      },
    },
  })

  return (
    <MaterialNameField
      value={field.value}
      materials={materials}
      readOnly={readOnly}
      keepMaterialOnType={kind === 'edit'}
      loading={loading}
      noun={noun}
      nameLabel={fieldLabel}
      createLabel={createLabel}
      allowCreate={allowCreate}
      errorText={fieldState.error?.message}
      onBlur={field.onBlur}
      onChange={field.onChange}
      onSelect={onSelect}
    />
  )
}

function readPath(values: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, values)
}
