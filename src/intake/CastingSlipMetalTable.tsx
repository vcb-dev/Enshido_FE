import { Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import {
  WAX_TO_GOLD_RATIO,
  WAX_TO_SILVER_RATIO,
  type GoldKarat,
  type SilverEstimate,
} from './castingEstimate'
import type { ReactNode } from 'react'
import { formatQty } from '../api/inventory'
import { FormQtyField } from '../components/ui'
import type { FieldValues, Path } from 'react-hook-form'

const tableSx = {
  border: '2px solid',
  borderColor: 'grey.600',
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': {
    border: '1px solid',
    borderColor: 'grey.500',
    py: 1.25,
    px: 1.5,
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    bgcolor: 'grey.200',
    fontWeight: 700,
  },
} as const

const disabledCell = { bgcolor: 'action.hover', color: 'text.disabled' } as const

function formatGram(value: string | null | undefined) {
  if (value == null || value === '') return '—'
  return formatQty(value)
}

type MetalRow = { label: string; estimate: string | null; issue: string | null }

export function CastingSlipMetalTable({
  estimateS999Gram,
  estimateMasterAlloyGram,
  estimateS925Gram,
  estimateGoldGram,
  estimateTotalGram,
  issueS999Gram,
  issueMasterAlloyGram,
  issueS925Gram,
  issueGoldGram,
  issueTotalGram,
  returnTotalGram,
  extraRows,
}: {
  estimateS999Gram?: string | null
  estimateMasterAlloyGram?: string | null
  estimateS925Gram?: string | null
  estimateGoldGram?: string | null
  estimateTotalGram?: string | null
  issueS999Gram?: string | null
  issueMasterAlloyGram?: string | null
  issueS925Gram?: string | null
  issueGoldGram?: string | null
  issueTotalGram?: string | null
  returnTotalGram?: string | null
  extraRows?: ReactNode
}) {
  const goldIssued = issueGoldGram != null && issueGoldGram !== '' && Number(issueGoldGram) > 0
  const goldEstimated = estimateGoldGram != null && estimateGoldGram !== '' && Number(estimateGoldGram) > 0
  const rows: MetalRow[] = [
    { label: 'S999 (g)', estimate: estimateS999Gram ?? null, issue: issueS999Gram ?? null },
    { label: 'Hội (g)', estimate: estimateMasterAlloyGram ?? null, issue: issueMasterAlloyGram ?? null },
    { label: 'S925 (g)', estimate: estimateS925Gram ?? null, issue: issueS925Gram ?? null },
    ...(goldIssued || goldEstimated
      ? [{ label: 'Vàng (g)', estimate: estimateGoldGram ?? null, issue: issueGoldGram ?? null }]
      : []),
  ]
  return (
    <Stack spacing={0.75}>
      <Table size="small" sx={tableSx}>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell align="center">Trọng lượng ước tính theo gram</TableCell>
            <TableCell align="center">Trọng lượng thực xuất</TableCell>
            <TableCell align="center">Trả</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell align="right">{formatGram(row.estimate)}</TableCell>
              <TableCell align="right">{formatGram(row.issue)}</TableCell>
              <TableCell align="center" sx={disabledCell}>
                x
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Tổng</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {formatGram(estimateTotalGram)}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {formatGram(issueTotalGram)}
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              {returnTotalGram != null && returnTotalGram !== '' ? (
                formatGram(returnTotalGram)
              ) : (
                <Typography component="span" variant="caption" color="text.secondary">
                  chờ thợ đúc nhập kết quả
                </Typography>
              )}
            </TableCell>
          </TableRow>
          {extraRows}
        </TableBody>
      </Table>
      <Typography variant="caption" color="text.secondary">
        Ước tính bạc = TL sáp × {WAX_TO_SILVER_RATIO}. Vàng 10k × {WAX_TO_GOLD_RATIO['10']} · 14k ×{' '}
        {WAX_TO_GOLD_RATIO['14']} · 18k × {WAX_TO_GOLD_RATIO['18']} · 24k × {WAX_TO_GOLD_RATIO['24']}.
      </Typography>
    </Stack>
  )
}

export function CastingSlipMetalFormTable<T extends FieldValues>({
  issueNames,
  estimate,
  goldEstimate,
  goldKarat,
  issueTotal,
  disabled,
}: {
  issueNames: { s999: Path<T>; hoi: Path<T>; s925: Path<T>; gold: Path<T> }
  estimate: SilverEstimate
  goldEstimate?: number
  goldKarat?: GoldKarat | null
  issueTotal: number
  disabled?: boolean
}) {
  const gramText = (value: number) => (value > 0 ? `${formatQty(String(value))} g` : '—')
  const lines: Array<{ label: string; issue: Path<T>; estimate: number | null }> = [
    { label: 'S999 (g)', issue: issueNames.s999, estimate: estimate.s999 },
    { label: 'Hội (g)', issue: issueNames.hoi, estimate: estimate.masterAlloy },
    { label: 'S925 (g)', issue: issueNames.s925, estimate: estimate.s925 },
    { label: 'Vàng (g)', issue: issueNames.gold, estimate: goldEstimate && goldEstimate > 0 ? goldEstimate : null },
  ]
  return (
    <Stack spacing={0.75}>
      <Table size="small" sx={tableSx}>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell align="center">Trọng lượng ước tính theo gram</TableCell>
            <TableCell align="center">Trọng lượng thực xuất</TableCell>
            <TableCell align="center">Trả</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell align="right">{row.estimate == null ? '—' : gramText(row.estimate)}</TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <FormQtyField<T>
                  name={row.issue}
                  hiddenLabel
                  size="small"
                  fullWidth
                  disabled={disabled}
                  sx={{ '& .MuiInputBase-input': { textAlign: 'right' } }}
                />
              </TableCell>
              <TableCell align="center" sx={disabledCell}>
                x
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Tổng</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {gramText(estimate.total)}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {formatQty(String(issueTotal))} g
            </TableCell>
            <TableCell align="center" sx={disabledCell}>
              x
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Typography variant="caption" color="text.secondary">
        {goldKarat
          ? `Ước tính bạc = TL sáp × ${WAX_TO_SILVER_RATIO}. Ước tính vàng ${goldKarat}k = TL sáp × ${WAX_TO_GOLD_RATIO[goldKarat]}.`
          : `Ước tính bạc = TL sáp × ${WAX_TO_SILVER_RATIO}. Chọn mã NVL vàng (10k/14k/18k/24k) để ra ước tính vàng.`}
      </Typography>
    </Stack>
  )
}
