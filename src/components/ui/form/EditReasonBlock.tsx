import { Box, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useController } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
import { listEditLogsApi } from '../../../api/editLogs'
import { formatDateTime } from '../../../orders/catalog'
import type { FormFieldBaseProps } from './field'

export type EditLogTarget = {
  entityType: string
  entityId?: string | null
}

type EditReasonBlockProps = EditLogTarget & {
  reason: string
  onReasonChange: (value: string) => void
  required?: boolean
  error?: string
  readOnly?: boolean
}

export function EditReasonBlock({
  entityType,
  entityId,
  reason,
  onReasonChange,
  required,
  error,
  readOnly,
}: EditReasonBlockProps) {
  const logs = useQuery({
    queryKey: ['edit-logs', entityType, entityId],
    queryFn: () => listEditLogsApi(entityType, entityId!),
    enabled: Boolean(entityId),
  })

  return (
    <Box
      sx={{
        mt: 0.5,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      {readOnly ? null : (
        <TextField
          label="Lý do chỉnh sửa"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          required={required}
          error={Boolean(error)}
          helperText={error}
          multiline
          minRows={2}
          maxRows={6}
          size="small"
          fullWidth
        />
      )}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
          Lịch sử chỉnh sửa
        </Typography>
        {!entityId ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có lần chỉnh sửa nào.
          </Typography>
        ) : logs.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Đang tải lịch sử…
          </Typography>
        ) : !logs.data?.length ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có lần chỉnh sửa nào.
          </Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {logs.data.map((entry) => (
              <Box component="li" key={entry.id}>
                <Typography variant="body2">
                  {entry.reason}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {entry.changedBy} · {formatDateTime(entry.changedAt)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * `EditReasonBlock` nối với react-hook-form qua Controller: lý do là một field của form, bắt buộc
 * khi `required` (chỉ khoảng trắng cũng tính là trống).
 */
export function FormEditReasonBlock<T extends FieldValues>({
  name,
  control,
  required,
  entityType,
  entityId,
  readOnly,
}: Pick<FormFieldBaseProps<T>, 'name' | 'control' | 'required'> & EditLogTarget & { readOnly?: boolean }) {
  const { field, fieldState } = useController({
    name,
    control,
    rules: required
      ? { validate: (value: string | undefined) => (value?.trim() ? true : 'Nhập lý do chỉnh sửa') }
      : undefined,
  })
  return (
    <EditReasonBlock
      entityType={entityType}
      entityId={entityId}
      reason={(field.value as string | undefined) ?? ''}
      onReasonChange={field.onChange}
      required={required}
      error={fieldState.error?.message}
      readOnly={readOnly}
    />
  )
}
