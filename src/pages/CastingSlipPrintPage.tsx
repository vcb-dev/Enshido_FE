import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Alert, Box, Button, GlobalStyles, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getCastingSlipByCodeApi, markCastingSlipPrintedApi, type CastingSlip } from '../api/castingSlips'
import { formatQty } from '../api/inventory'
import { PrintSheetSkeleton } from '../components/ui'
import { formatDateTime } from '../orders/catalog'

type Paper = 'A5' | 'A4'

const PAPER_WIDTH: Record<Paper, string> = { A5: '148mm', A4: '210mm' }
const HEADER_BG = '#fff2cc'
const TITLE_RED = '#e0403a'

/**
 * In phiếu đúc (`/casting/:code/print`, bước 7). Thủ kho in kèm vật tư giao thợ đúc; QR mở
 * `/casting/:code` để thợ đúc quét nhận (bước 8).
 */
export function CastingSlipPrintPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [paper, setPaper] = useState<Paper>('A5')
  const autoPrinted = useRef(false)

  const detail = useQuery({
    queryKey: ['casting-slip', code],
    queryFn: () => getCastingSlipByCodeApi(code),
    staleTime: 0,
  })

  async function print() {
    window.print()
    if (!detail.data) return
    try {
      await markCastingSlipPrintedApi(detail.data.id)
      void queryClient.invalidateQueries({ queryKey: ['casting-slips'] })
    } catch {
      /* in giấy vẫn xong; lần in chỉ không được ghi nhận */
    }
  }

  useEffect(() => {
    if (!detail.data || autoPrinted.current) return
    autoPrinted.current = true
    const timer = setTimeout(() => void print(), 400)
    return () => clearTimeout(timer)
  }, [detail.data])

  if (detail.isLoading) return <PrintSheetSkeleton />
  if (!detail.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          {detail.error instanceof Error ? detail.error.message : 'Không tải được phiếu đúc'}
        </Alert>
      </Box>
    )
  }
  const slip = detail.data

  return (
    <Box className="ticket-screen" sx={{ height: '100dvh', overflow: 'auto', bgcolor: '#e5e8eb', px: 2, pb: 3 }}>
      <GlobalStyles
        styles={{
          '@page': { size: `${paper} portrait`, margin: '6mm' },
          '@media print': {
            'html, body, #root': { height: 'auto !important', overflow: 'visible !important', background: '#fff !important' },
            '.ticket-toolbar': { display: 'none !important' },
            '.ticket-screen': { padding: '0 !important', background: '#fff !important', height: 'auto !important', overflow: 'visible !important' },
            '.ticket': { boxShadow: 'none !important', margin: '0 !important', width: 'auto !important', padding: '0 !important' },
          },
        }}
      />
      <Stack
        className="ticket-toolbar"
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ py: 1.5, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => void print()}>
          In phiếu đúc
        </Button>
        <ToggleButtonGroup size="small" exclusive value={paper} onChange={(_, value: Paper | null) => value && setPaper(value)}>
          <ToggleButton value="A5">A5 dọc</ToggleButton>
          <ToggleButton value="A4">A4 dọc</ToggleButton>
        </ToggleButtonGroup>
        <Button
          onClick={() => {
            window.close()
            setTimeout(() => navigate('/casting'), 150)
          }}
        >
          Đóng
        </Button>
      </Stack>

      <Box
        className="ticket"
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
          '& table': { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', breakInside: 'avoid' },
          '& th, & td': { border: '0.6pt solid #000', padding: '0.8mm 1.2mm', verticalAlign: 'middle' },
        }}
      >
        <Sheet slip={slip} printedBy={user?.fullName || user?.username || ''} />
      </Box>
    </Box>
  )
}

function gram(value: string | null) {
  return value == null ? '' : formatQty(value)
}

function Sheet({ slip, printedBy }: { slip: CastingSlip; printedBy: string }) {
  // QR mở phiếu trên hệ thống để thợ đúc bấm "Bắt đầu đúc" (bước 8).
  const url = `${window.location.origin}/casting/${slip.code}`
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '3mm', mb: '2mm' }}>
        <Box>
          <Box sx={{ fontSize: '1.6em', fontWeight: 700, color: TITLE_RED }}>PHIẾU ĐÚC</Box>
          <div>
            Mã phiếu: <b>{slip.code}</b>
          </div>
          <div>Ngày: {slip.slipDate.split('-').reverse().join('/')}</div>
          <div>
            Mã đơn hàng trong lô đúc: <b>{slip.batchOrderCodes}</b>
          </div>
        </Box>
        <QRCodeSVG value={url} size={72} />
      </Box>

      <table>
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '16%' }} />
          <col />
          <col style={{ width: '9%' }} />
          <col style={{ width: '16%' }} />
        </colgroup>
        <tbody>
          <tr>
            <Head>STT</Head>
            <Head>Mã đơn</Head>
            <Head>Mã SP</Head>
            <Head>Tên sản phẩm</Head>
            <Head>SL</Head>
            <Head>TL sáp (g)</Head>
          </tr>
          {slip.orders.map((line, index) => (
            <tr key={line.intakeOrderId}>
              <td style={center}>{index + 1}</td>
              <td style={{ fontWeight: 700 }}>{line.code}</td>
              <td>{line.trackingCode ?? ''}</td>
              <td>{line.productName}</td>
              <td style={right}>{line.qty}</td>
              <td style={right}>{formatQty(line.waxWeightGram)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{ fontWeight: 700, textAlign: 'right' }}>
              Trọng lượng sáp (cây thông) giao
            </td>
            <td style={{ ...right, fontWeight: 700 }}>{formatQty(slip.waxWeightGram)}</td>
          </tr>
        </tbody>
      </table>

      <table style={{ marginTop: '2mm' }}>
        <colgroup>
          <col style={{ width: '40%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <tbody>
          <tr>
            <Head> </Head>
            <Head>Giao</Head>
            <Head>Trả</Head>
          </tr>
          <tr>
            <td>Trọng lượng bạc S999 (gram)</td>
            <td style={right}>{gram(slip.issueS999Gram)}</td>
            <td style={crossed}>x</td>
          </tr>
          <tr>
            <td>Trọng lượng Hội (gram)</td>
            <td style={right}>{gram(slip.issueMasterAlloyGram)}</td>
            <td style={crossed}>x</td>
          </tr>
          <tr>
            <td>Trọng lượng S925 (gram)</td>
            <td style={right}>{gram(slip.issueS925Gram)}</td>
            <td style={crossed}>x</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700 }}>Tổng</td>
            <td style={{ ...right, fontWeight: 700 }}>{formatQty(slip.issueTotalGram)}</td>
            {/* Trả = cây thông sau đúc. Chưa đúc thì để trống cho thủ kho viết tay khi nhận lại. */}
            <td style={{ ...right, fontWeight: 700 }}>{gram(slip.returnTotalGram)}</td>
          </tr>
          {slip.castLossGram != null ? (
            <tr>
              <td>Hao hụt đúc (bạc đã dùng − cây thông)</td>
              <td colSpan={2} style={{ ...right, fontWeight: 700 }}>
                {gram(slip.castLossGram)}
                {slip.castLossPercent != null ? ` (${slip.castLossPercent}%)` : ''}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <table style={{ marginTop: '2mm' }}>
        <tbody>
          <tr>
            <Head>Thủ kho</Head>
            <Head>Ký nhận bàn giao</Head>
            <Head>Ký nhận lại</Head>
          </tr>
          <tr style={{ height: '16mm' }}>
            <td style={{ ...center, verticalAlign: 'bottom' }}>{slip.createdByName ?? ''}</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>

      <Box sx={{ mt: '2mm', display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#333' }}>
        <span>Thợ đúc quét QR để nhận phiếu</span>
        <span>
          In lúc {formatDateTime(new Date().toISOString())}
          {printedBy ? ` · ${printedBy}` : ''}
        </span>
      </Box>
    </>
  )
}

const center: CSSProperties = { textAlign: 'center' }
const right: CSSProperties = { textAlign: 'right' }
const crossed: CSSProperties = { textAlign: 'center', background: '#eee' }

function Head({ children }: { children: ReactNode }) {
  return <th style={{ background: HEADER_BG, fontWeight: 700, textAlign: 'center' }}>{children}</th>
}
