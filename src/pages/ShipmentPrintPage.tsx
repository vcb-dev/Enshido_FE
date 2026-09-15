import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  GlobalStyles,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getShipmentApi, markShipmentPrintedApi, type ShipmentDetail } from '../api/finishedGoods'
import { formatMoney } from '../api/inventory'
import { cloudinaryThumb } from '../api/uploads'
import { formatDateTime } from '../orders/catalog'

type Paper = 'A5' | 'A4'

const PAPER_WIDTH: Record<Paper, string> = { A5: '210mm', A4: '297mm' }

/**
 * Bản in TẠM của phiếu xuất hàng — chưa có mẫu "Phiếu xuất hàng kim hoàn" đủ cột.
 * Bố cục gom trong `ShipmentSheet` để chỉnh theo mẫu thật khi có.
 */
export function ShipmentPrintPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [paper, setPaper] = useState<Paper>('A5')
  const [showCost, setShowCost] = useState(true)
  const autoPrinted = useRef(false)

  const detail = useQuery({ queryKey: ['shipment', code], queryFn: () => getShipmentApi(code), staleTime: 0 })

  async function print() {
    window.print()
    try {
      const { lastPrintedAt } = await markShipmentPrintedApi(code)
      queryClient.setQueryData<ShipmentDetail>(['shipment', code], (prev) => (prev ? { ...prev, lastPrintedAt } : prev))
    } catch {
      /* in giấy vẫn xong; lần in chỉ không được ghi nhận */
    }
  }

  useEffect(() => {
    if (!detail.data || autoPrinted.current) return
    autoPrinted.current = true
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.sheet img'))
    const loaded = Promise.all(
      images.map((img) =>
        img.complete ? Promise.resolve() : new Promise((resolve) => img.addEventListener('load', resolve, { once: true })),
      ),
    )
    void Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 2500))]).then(() => print())
  }, [detail.data])

  if (detail.isLoading) {
    return (
      <Stack sx={{ py: 8, alignItems: 'center' }}>
        <CircularProgress size={28} />
      </Stack>
    )
  }
  if (!detail.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{detail.error instanceof Error ? detail.error.message : 'Không tải được phiếu xuất'}</Alert>
      </Box>
    )
  }

  return (
    <Box className="sheet-screen" sx={{ height: '100dvh', overflow: 'auto', bgcolor: '#e5e8eb', px: 2, pb: 3 }}>
      <GlobalStyles
        styles={{
          '@page': { size: `${paper} landscape`, margin: '6mm' },
          '@media print': {
            'html, body, #root': { height: 'auto !important', overflow: 'visible !important', background: '#fff !important' },
            '.sheet-toolbar': { display: 'none !important' },
            '.sheet-screen': { padding: '0 !important', background: '#fff !important', height: 'auto !important', overflow: 'visible !important' },
            '.sheet': { boxShadow: 'none !important', margin: '0 !important', width: 'auto !important', padding: '0 !important' },
          },
        }}
      />
      <Stack
        className="sheet-toolbar"
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ py: 1.5, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => void print()}>
          In phiếu
        </Button>
        <ToggleButtonGroup size="small" exclusive value={paper} onChange={(_, value: Paper | null) => value && setPaper(value)}>
          <ToggleButton value="A5">A5 ngang</ToggleButton>
          <ToggleButton value="A4">A4 ngang</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch checked={showCost} onChange={(event) => setShowCost(event.target.checked)} />}
          label="In chi phí"
        />
        <Button
          onClick={() => {
            window.close()
            setTimeout(() => navigate(`/finished-goods/shipments/${code}`), 150)
          }}
        >
          Đóng
        </Button>
      </Stack>
      <Alert className="sheet-toolbar" severity="info" sx={{ maxWidth: 760, mx: 'auto', mb: 1.5 }}>
        Bản in tạm — sẽ chỉnh theo mẫu "Phiếu xuất hàng kim hoàn" khi có đủ cột. Tắt "In chi phí" khi in bản giao khách.
      </Alert>

      <Box
        className="sheet"
        sx={{
          width: PAPER_WIDTH[paper],
          maxWidth: '100%',
          mx: 'auto',
          p: '6mm',
          bgcolor: '#fff',
          color: '#000',
          boxShadow: '0 1px 6px rgba(0,0,0,.2)',
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: paper === 'A5' ? '9pt' : '11pt',
          lineHeight: 1.25,
          '& table': { width: '100%', borderCollapse: 'collapse' },
          '& th, & td': { border: '0.6pt solid #000', padding: '0.8mm 1.2mm', verticalAlign: 'middle' },
          '& th': { background: '#fff34d', fontWeight: 700, textAlign: 'center' },
        }}
      >
        <ShipmentSheet shipment={detail.data} showCost={showCost} printedBy={user?.fullName || user?.username || ''} />
      </Box>
    </Box>
  )
}

const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' }

function ShipmentSheet({
  shipment,
  showCost,
  printedBy,
}: {
  shipment: ShipmentDetail
  showCost: boolean
  printedBy: string
}) {
  const [y, m, d] = shipment.shippedAt.split('-')
  return (
    <>
      <Box sx={{ textAlign: 'center', color: '#e0403a', fontWeight: 700, fontSize: '1.45em' }}>Phiếu xuất hàng kim hoàn</Box>
      <Box sx={{ textAlign: 'center', mb: '2mm' }}>
        Số: <b>{shipment.code}</b> · Ngày {d}/{m}/{y}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '6mm', rowGap: '0.8mm', mb: '2mm' }}>
        <span>
          Khách hàng: <b>{shipment.customerName}</b>
        </span>
        <span>
          Hình thức thanh toán: <b>{shipment.paymentMethod ?? '………………'}</b>
        </span>
        <span style={{ gridColumn: '1 / -1' }}>Ghi chú: {shipment.note ?? ''}</span>
      </Box>

      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>STT</th>
            <th style={{ width: '9%' }}>Mã SX</th>
            <th style={{ width: '8%' }}>Ảnh</th>
            <th>Sản phẩm</th>
            <th style={{ width: '6%' }}>SL</th>
            <th style={{ width: '12%' }}>Đơn giá</th>
            <th style={{ width: '13%' }}>Thành tiền</th>
            {showCost ? <th style={{ width: '13%' }}>Chi phí</th> : null}
            <th style={{ width: '12%' }}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {shipment.lines.map((line, index) => (
            <tr key={line.id}>
              <td style={{ textAlign: 'center' }}>{index + 1}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{line.orderCode}</td>
              <td style={{ textAlign: 'center' }}>
                {line.imageUrl ? (
                  <img src={cloudinaryThumb(line.imageUrl, 120)} alt="" style={{ width: '12mm', height: '12mm', objectFit: 'cover' }} />
                ) : null}
              </td>
              <td>
                {line.description}
                {line.sizeLabel || line.mainMaterial ? (
                  <div style={{ fontSize: '0.85em', color: '#333' }}>
                    {[line.sizeLabel && `Size ${line.sizeLabel}`, line.mainMaterial].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
              </td>
              <td style={right}>{line.qty}</td>
              <td style={right}>{formatMoney(line.unitPrice)}</td>
              <td style={{ ...right, fontWeight: 700 }}>{formatMoney(line.amount)}</td>
              {showCost ? <td style={right}>{formatMoney(line.costAmount)}</td> : null}
              <td>{line.note ?? ''}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ fontWeight: 700, textAlign: 'center' }}>
              Cộng
            </td>
            <td style={{ ...right, fontWeight: 700 }}>{shipment.totals.qty}</td>
            <td />
            <td style={{ ...right, fontWeight: 700 }}>{formatMoney(shipment.totals.amount)} đ</td>
            {showCost ? <td style={{ ...right, fontWeight: 700 }}>{formatMoney(shipment.totals.costAmount)} đ</td> : null}
            <td />
          </tr>
        </tbody>
      </table>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', mt: '4mm', minHeight: '18mm' }}>
        <div>
          <b>Người lập phiếu</b>
          <div style={{ marginTop: '12mm' }}>{shipment.createdByName}</div>
        </div>
        <div>
          <b>Người nhận hàng</b>
          <div style={{ fontSize: '0.85em' }}>(ký, ghi rõ họ tên)</div>
        </div>
      </Box>

      <Box sx={{ mt: '2mm', display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#333' }}>
        <span>Dữ liệu cập nhật lúc {formatDateTime(shipment.dataChangedAt)}</span>
        <span>
          In lúc {formatDateTime(new Date().toISOString())}
          {printedBy ? ` · ${printedBy}` : ''}
        </span>
      </Box>
    </>
  )
}
