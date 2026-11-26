import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { formatQty } from '../api/inventory'
import { getMyToolsApi } from '../api/tools'
import { useIsMobile } from '../hooks/useBreakpoint'

/**
 * Thợ xem dụng cụ mình đang giữ (xuất từ kho dụng cụ). Chỉ xem — trả / báo hỏng / mất thì mang tới
 * thủ kho ghi phiếu. Không hiện tiền.
 */
export function MyToolsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fullScreen = useIsMobile()
  const tools = useQuery({ queryKey: ['tools', 'mine'], queryFn: getMyToolsApi, enabled: open })
  const rows = tools.data ?? []

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="xs">
      <DialogTitle>Dụng cụ đang giữ</DialogTitle>
      <DialogContent dividers>
        {tools.isLoading ? (
          <Stack spacing={1}>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        ) : tools.error instanceof Error ? (
          <Alert severity="error">{tools.error.message}</Alert>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary">Bạn chưa giữ dụng cụ nào của kho.</Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {rows.map((row) => (
              <Stack key={row.materialId} direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography>
                  {row.sku ? (
                    <Typography variant="caption" color="text.secondary">
                      {row.sku}
                    </Typography>
                  ) : null}
                </Box>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatQty(row.qty)} {row.unitName}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Trả lại, báo hao mòn, hỏng hoặc mất: mang dụng cụ tới thủ kho để ghi phiếu.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  )
}
