import type { ComponentProps, ReactNode } from 'react'
import { FormProvider } from 'react-hook-form'
import type { FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form'
import { Box, Stack } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type FormProps<T extends FieldValues> = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  form: UseFormReturn<T>
  onSubmit: SubmitHandler<T>
  children: ReactNode
}

/**
 * Bọc `<form>` + FormProvider. Các field bên trong tự lấy `control` từ context
 * nên không phải truyền tay.
 *
 * ```tsx
 * const form = useForm<UserFormValues>({ defaultValues })
 * <Form form={form} onSubmit={(values) => mutation.mutate(values)}>
 *   <FormTextField<UserFormValues> name="fullName" label="Họ tên" required />
 * </Form>
 * ```
 */
export function Form<T extends FieldValues>({
  form,
  onSubmit,
  children,
  ...props
}: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} {...props}>
        {children}
      </form>
    </FormProvider>
  )
}

/** Xếp các field thành lưới, tự xuống một cột trên màn hình hẹp. */
export function FormRow({
  columns = 2,
  children,
  sx,
}: {
  columns?: number
  children: ReactNode
  sx?: SxProps<Theme>
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        alignItems: 'start',
        gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, minmax(0, 1fr))` },
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

/** Hàng nút của form đặt trực tiếp trên trang (trong Dialog thì dùng DialogActions). */
export function FormActions({
  children,
  align = 'right',
}: {
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ pt: 1, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
    >
      {children}
    </Stack>
  )
}
