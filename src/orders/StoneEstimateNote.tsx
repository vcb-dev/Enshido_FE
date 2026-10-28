import { Alert, Box, Link, Typography } from '@mui/material'
import { formatCt } from '../api/inventory'
import type { ProductionOrderDetail } from '../api/productionOrders'
import { KcsImages } from './KcsImages'

/**
 * Đá ước tính theo file 3D (khai ở bước 3D, tính cho cả đơn) — gợi ý thủ kho cấp đá khi giao Vào đá.
 * Giao một phần đơn (phiếu con) thì chia theo tỉ lệ số lượng giao. Kèm ảnh file 3D thợ 3D tải lên
 * để thủ kho biết vị trí, cỡ đá trên mẫu. Chưa khai đá lẫn chưa có ảnh thì không hiện.
 */
export function StoneEstimateNote({
  order,
  qty,
}: {
  order: Pick<ProductionOrderDetail, 'qty' | 'stoneCount' | 'stoneWeight' | 'model3dUrl' | 'images'>
  qty: number
}) {
  const count = order.stoneCount ?? 0
  const weight = Number(order.stoneWeight ?? 0)
  const model3dImages = order.images.filter((image) => image.kind === 'MODEL_3D')
  const hasStone = count > 0 || weight > 0
  if (!hasStone && model3dImages.length === 0) return null
  const describe = (share: number, approx: string) =>
    [
      count > 0 ? `${approx}${Math.round(count * share)} viên` : null,
      weight > 0 ? `${approx}${formatCt(weight * share)}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  const share = qty > 0 && qty < order.qty ? qty / order.qty : null
  const link = order.model3dUrl?.trim() ?? ''

  return (
    <Alert severity="info" sx={{ mt: 1 }}>
      {hasStone ? (
        <>
          Đá ước tính theo file 3D: <b>{describe(1, '')}</b> cho cả đơn {order.qty} sp.
          {share != null ? (
            <>
              {' '}
              Phần giao {qty} sp: <b>{describe(share, '~')}</b>.
            </>
          ) : null}
        </>
      ) : (
        'Ảnh file 3D của đơn:'
      )}
      {model3dImages.length > 0 ? (
        <Box sx={{ mt: 0.5 }}>
          <KcsImages images={model3dImages} size={72} title="Ảnh file 3D" />
        </Box>
      ) : null}
      {/^https?:\/\//i.test(link) ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          <Link href={link} target="_blank" rel="noreferrer">
            Mở file 3D
          </Link>
        </Typography>
      ) : null}
    </Alert>
  )
}
