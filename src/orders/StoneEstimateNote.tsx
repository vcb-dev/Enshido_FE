import { Alert } from '@mui/material'
import { formatCt } from '../api/inventory'
import type { ProductionOrderDetail } from '../api/productionOrders'

/**
 * Đá ước tính theo file 3D (khai ở bước 3D, tính cho cả đơn) — gợi ý thủ kho cấp đá khi giao Vào đá.
 * Giao một phần đơn (phiếu con) thì chia theo tỉ lệ số lượng giao. Chưa khai thì không hiện.
 */
export function StoneEstimateNote({
  order,
  qty,
}: {
  order: Pick<ProductionOrderDetail, 'qty' | 'stoneCount' | 'stoneWeight'>
  qty: number
}) {
  const count = order.stoneCount ?? 0
  const weight = Number(order.stoneWeight ?? 0)
  if (count <= 0 && weight <= 0) return null
  const describe = (share: number, approx: string) =>
    [
      count > 0 ? `${approx}${Math.round(count * share)} viên` : null,
      weight > 0 ? `${approx}${formatCt(weight * share)}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  const share = qty > 0 && qty < order.qty ? qty / order.qty : null

  return (
    <Alert severity="info" sx={{ mt: 1 }}>
      Đá ước tính theo file 3D: <b>{describe(1, '')}</b> cho cả đơn {order.qty} sp.
      {share != null ? (
        <>
          {' '}
          Phần giao {qty} sp: <b>{describe(share, '~')}</b>.
        </>
      ) : null}
    </Alert>
  )
}
