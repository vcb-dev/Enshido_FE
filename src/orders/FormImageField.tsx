import { Stack, Typography } from '@mui/material'
import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import type { OrderImage, ProductionImageKind } from '../api/productionOrders'
import type { FormFieldBaseProps } from '../components/ui/form/field'
import { ImageUploadField } from './ImageUploadField'

export type FormImageFieldProps<T extends FieldValues> = FormFieldBaseProps<T> & {
  label: string
  kind: ProductionImageKind
  onUploadingChange?: (uploading: boolean) => void
  readOnly?: boolean
  /** Thông báo khi `required` mà chưa có ảnh nào. */
  requiredMessage?: string
}

/** Ô tải ảnh (Cloudinary) nối với react-hook-form qua Controller — giá trị là mảng `OrderImage`. */
export function FormImageField<T extends FieldValues>({
  name,
  control,
  rules,
  required,
  requiredMessage = 'Thêm ít nhất một ảnh (tải file hoặc Ctrl+V)',
  ...props
}: FormImageFieldProps<T>) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: required
      ? {
          ...rules,
          validate: (value: OrderImage[] | undefined) => (value?.length ? true : requiredMessage),
        }
      : rules,
  })
  return (
    <Stack spacing={0.5}>
      <ImageUploadField
        {...props}
        value={(field.value as OrderImage[] | undefined) ?? []}
        onChange={(images) => field.onChange(images)}
      />
      {fieldState.error?.message ? (
        <Typography variant="caption" color="error">
          {fieldState.error.message}
        </Typography>
      ) : null}
    </Stack>
  )
}
