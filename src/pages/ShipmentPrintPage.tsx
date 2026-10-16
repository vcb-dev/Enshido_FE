import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Alert, Box, Button, GlobalStyles, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { getShipmentApi, markShipmentPrintedApi, type ShipmentDetail } from '../api/finishedGoods'
import { formatMoney } from '../api/inventory'
import { PrintSheetSkeleton } from '../components/ui'
import { formatGram } from '../finishedGoods/invoice'
import { REQUEST_TYPE_META } from '../orders/catalog'

type Paper = 'A5' | 'A4'

const PAPER_WIDTH: Record<Paper, string> = { A5: '210mm', A4: '297mm' }

/** Xưởng in trên đầu hoá đơn. */
const WORKSHOP = 'T5- 39 Cầu Diễn'

/**
 * Phiếu xuất hàng in theo mẫu "Hoá đơn xuất hàng" của xưởng. Chỉ in khi mọi dòng đã đủ TL,
 * đơn giá NL, tiền công, tiền đá (`printable`; chi phí khác không bắt buộc).
 */
export function ShipmentPrintPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paper, setPaper] = useState<Paper>('A4')
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
    if (!detail.data?.printable || autoPrinted.current) return
    autoPrinted.current = true
    void print()
  }, [detail.data])

  if (detail.isLoading) return <PrintSheetSkeleton />
  if (!detail.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{detail.error instanceof Error ? detail.error.message : 'Không tải được phiếu xuất'}</Alert>
      </Box>
    )
  }

  if (!detail.data.printable) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => navigate(`/finished-goods/shipments/${code}`)}>
              Về phiếu
            </Button>
          }
        >
          Phiếu {detail.data.code} chưa in được — nhập đủ TL, đơn giá NL, tiền công, tiền đá cho mọi dòng.
        </Alert>
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
        <Button
          onClick={() => {
            window.close()
            setTimeout(() => navigate(`/finished-goods/shipments/${code}`), 150)
          }}
        >
          Đóng
        </Button>
      </Stack>

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
          fontSize: paper === 'A5' ? '7.5pt' : '10pt',
          lineHeight: 1.25,
          '& table': { width: '100%', borderCollapse: 'collapse' },
          '& th, & td': { border: '0.6pt solid #000', padding: '0.8mm 1mm', verticalAlign: 'middle', textAlign: 'center' },
          '& th': { background: '#f9d5a7', fontWeight: 700 },
          '& .lead': { background: '#dcf3dc' },
          '& .sum td': { background: '#f9d5a7', fontWeight: 700 },
          '& .sum td.lead': { background: '#dcf3dc' },
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        <ShipmentSheet shipment={detail.data} />
      </Box>
    </Box>
  )
}

const right: CSSProperties = { textAlign: 'right', whiteSpace: 'nowrap' }

function ShipmentSheet({ shipment }: { shipment: ShipmentDetail }) {
  const shippedAt = shipment.shippedAt.replace(/-/g, '/')
  const [year, month] = shipment.shippedAt.split('-')
  return (
    <>
      <Box sx={{ textAlign: 'center', color: '#2457c5', fontWeight: 700, fontSize: '1.6em', mb: '2mm' }}>
        HOÁ ĐƠN XUẤT HÀNG
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontStyle: 'italic', mb: '1.5mm' }}>
        <span>
          Khách hàng: <b>{shipment.customerName}</b>
        </span>
        <span>
          Xưởng sản xuất: <b>{WORKSHOP}</b>
        </span>
        <span>
          Số: <b>{shipment.code}</b>
        </span>
      </Box>

      <table>
        <thead>
          <tr>
            <th className="lead" style={{ width: '7%' }}>
              Ngày xuất hàng
            </th>
            <th className="lead" style={{ width: '7%' }}>
              Loại đơn hàng
            </th>
            <th style={{ width: '6%' }}>Mã SX</th>
            <th>Tên sản phẩm - Mã đặt hàng</th>
            <th style={{ width: '6%' }}>Mã của Khách</th>
            <th style={{ width: '7%' }}>Khách hàng</th>
            <th style={{ width: '5%' }}>Số lượng</th>
            <th style={{ width: '6%' }}>Loại vàng/ bạc</th>
            <th style={{ width: '6%' }}>Trọng lượng(g)</th>
            <th style={{ width: '7%' }}>Đơn giá NL</th>
            <th style={{ width: '7%' }}>Tiền Công</th>
            <th style={{ width: '7%' }}>Tiền Đá</th>
            <th style={{ width: '7%' }}>Chi phí khác</th>
            <th style={{ width: '8%' }}>Thành Tiền</th>
          </tr>
        </thead>
        <tbody>
          {shipment.lines.map((line) => (
            <tr key={line.id}>
              <td>{shippedAt}</td>
              <td>{REQUEST_TYPE_META[line.requestType]?.label ?? ''}</td>
              <td style={{ fontWeight: 700 }}>{line.orderCode}</td>
              <td style={{ fontWeight: 700 }}>
                {line.description}
                {line.sizeLabel ? ` ${line.sizeLabel}` : ''}
              </td>
              <td>{line.customerCode ?? ''}</td>
              <td>{line.orderCustomerName ?? shipment.customerName}</td>
              <td>{line.qty}</td>
              <td>{line.mainMaterial ?? ''}</td>
              <td>{formatGram(line.weightGram)}</td>
              <td style={right}>{formatMoney(line.materialUnitPrice ?? '0')} đ</td>
              <td style={right}>{formatMoney(line.laborAmount ?? '0')} đ</td>
              <td style={right}>{formatMoney(line.stoneAmount ?? '0')} đ</td>
              <td style={right}>{formatMoney(line.otherAmount ?? '0')} đ</td>
              <td style={right}>{formatMoney(line.amount)} đ</td>
            </tr>
          ))}
          <tr className="sum">
            <td className="lead" />
            <td className="lead" />
            <td colSpan={4} />
            <td style={{ color: '#d32f2f' }}>{shipment.totals.qty}</td>
            <td colSpan={6} />
            <td style={{ ...right, color: '#2457c5' }}>{formatMoney(shipment.totals.amount)} đ</td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', mt: '6mm', minHeight: '24mm' }}>
        {['Người giao', 'Người nhận'].map((label) => (
          <div key={label}>
            <i>
              Ngày……/{month}/{year}
            </i>
            <div style={{ fontWeight: 700, marginTop: '1.5mm' }}>{label}</div>
            <div>(Ký, ghi họ tên)</div>
          </div>
        ))}
      </Box>
    </>
  )
}
