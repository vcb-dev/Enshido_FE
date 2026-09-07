import { Stack, Tab, Tabs, Typography } from '@mui/material'
import { useQueryParams } from '../hooks/useQueryParams'
import { StockPricePanel } from '../warehouses/StockPricePanel'

const PRICE_SCOPES = [
  { code: 'da', label: 'Kho đá' },
  { code: 'bac', label: 'Kho bạc' },
  { code: 'nvl-tieu-hao', label: 'Kho NVL tiêu hao' },
] as const

type ScopeCode = (typeof PRICE_SCOPES)[number]['code']

export function ProductPricePage() {
  // Tab nằm trên URL để link chia sẻ và nút back của trình duyệt hoạt động đúng.
  const [params, setParams] = useQueryParams({ scope: 'da' })
  const scope = (PRICE_SCOPES.some((item) => item.code === params.scope)
    ? params.scope
    : 'da') as ScopeCode

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <Stack sx={{ flexShrink: 0 }}>
        <Typography variant="h5">Cấu hình giá sản phẩm</Typography>
        <Typography variant="body2" color="text.secondary">
          Thêm tên hàng tại đây — kho tồn sẽ hiện cùng sản phẩm. Kho nhập / xuất chỉ chọn từ danh
          sách này.
        </Typography>
      </Stack>
      <Tabs
        value={scope}
        onChange={(_, next: ScopeCode) => setParams({ scope: next })}
        sx={{ flexShrink: 0, minHeight: 40, borderBottom: '1px solid #d5dbe0' }}
      >
        {PRICE_SCOPES.map((item) => (
          <Tab key={item.code} value={item.code} label={item.label} sx={{ minHeight: 40 }} />
        ))}
      </Tabs>
      <StockPricePanel key={scope} warehouseCode={scope} />
    </Stack>
  )
}
