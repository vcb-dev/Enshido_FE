import { Alert, Typography } from '@mui/material'
import { formatCt, formatQty } from '../api/inventory'
import type { stone3dMismatch } from './stoneReturn'

/**
 * Cảnh báo mốc TL đá 3D lệch đá thực tế — hao hụt Vào đá lấy TL đá 3D làm mốc nên khai sai
 * (nhầm ct/g, thiếu loại đá; đơn cũ khai tổng theo 1 sp) là hao ra âm / ảo. Dùng ở QC cân lại và
 * thủ kho xác nhận Vào đá.
 */
export function Stone3dMismatchAlert({ mismatch }: { mismatch: NonNullable<ReturnType<typeof stone3dMismatch>> }) {
  const lighter = mismatch.diffGram < 0
  return (
    <Alert severity="warning" sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        TL đá 3D có thể khai sai — lệch đá thực tế {formatQty(String(Math.abs(mismatch.diffPercent)))}%
      </Typography>
      <Typography variant="body2">
        Mốc tính hao theo TL đá 3D: <b>{formatCt(String(mismatch.stone3dGram))}</b> (
        {formatQty(String(mismatch.stone3dGram))} g) · đá thực tế (cấp − gói thừa):{' '}
        <b>{formatCt(String(mismatch.actualGram))}</b> ({formatQty(String(mismatch.actualGram))} g).
      </Typography>
      <Typography variant="body2">
        {lighter
          ? 'TL đá 3D nhẹ hơn đá gắn thật — hao hụt khâu sẽ bị thấp đi, có thể ra âm.'
          : 'TL đá 3D nặng hơn đá gắn thật — hao hụt khâu sẽ bị đội lên.'}{' '}
        Kiểm tra lại TL đá 3D của đơn (form File 3D nhập theo 1 sp, đơn vị ct) và gói đá thừa trước khi lưu.
      </Typography>
    </Alert>
  )
}
