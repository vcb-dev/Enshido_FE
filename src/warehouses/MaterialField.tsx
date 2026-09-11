import type { Control } from 'react-hook-form'
import { useController } from 'react-hook-form'
import { MaterialNameField, type StockMaterialOption } from './MaterialNameField'

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
  kind,
  readOnly,
  materials,
  onSelect,
}: {
  control: Control<any>
  kind: 'create' | 'edit' | 'view'
  readOnly: boolean
  materials: StockMaterialOption[]
  onSelect: (material: StockMaterialOption | null) => void
}) {
  const { field, fieldState } = useController({
    name: 'name',
    control,
    rules: {
      required: 'Chọn tên hàng từ Tồn',
      validate: (value, formValues: any) =>
        kind !== 'create' ||
        Boolean(formValues.materialId) ||
        String(value ?? '').trim().length === 0 ||
        'Chọn tên hàng từ danh sách, không nhập tự do',
    },
  })

  return (
    <MaterialNameField
      value={field.value}
      materials={materials}
      readOnly={readOnly}
      keepMaterialOnType={kind === 'edit'}
      errorText={fieldState.error?.message}
      onBlur={field.onBlur}
      onChange={field.onChange}
      onSelect={onSelect}
    />
  )
}
