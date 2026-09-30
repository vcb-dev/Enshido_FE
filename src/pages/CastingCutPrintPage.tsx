import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Alert, Box, Button, GlobalStyles, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getCastingCutApi, markCastingCutPrintedApi, type CastingCut } from '../api/castingCuts'
import { formatQty } from '../api/inventory'
import { PrintSheetSkeleton } from '../components/ui'
import { formatDateTime } from '../orders/catalog'

type Paper = 'A5' | 'A4'

const PAPER_WIDTH: Record<Paper, string> = { A5: '148mm', A4: '210mm' }
const HEADER_BG = '#fff2cc'
const TITLE_RED = '#e0403a'

/** In phiếu cắt cây thông (`/casting-cuts/:code/print`) — thủ kho giao phôi kèm phiếu. */
export function CastingCutPrintPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [paper, setPaper] = useState<Paper>('A5')
  const autoPrinted = useRef(false)

  const detail = useQuery({
    queryKey: ['casting-cut', code],
    queryFn: () => getCastingCutApi(code),
    staleTime: 0,
  })

  async function print() {
    window.print()
    try {
      await markCastingCutPrintedApi(code)
      void queryClient.invalidateQueries({ queryKey: ['casting-cuts'] })
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
          {detail.error instanceof Error ? detail.error.message : 'Không tải được phiếu cắt'}
        </Alert>
      </Box>
    )
  }
  const cut = detail.data

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
          In phiếu cắt
        </Button>
        <ToggleButtonGroup size="small" exclusive value={paper} onChange={(_, value: Paper | null) => value && setPaper(value)}>
          <ToggleButton value="A5">A5 dọc</ToggleButton>
          <ToggleButton value="A4">A4 dọc</ToggleButton>
        </ToggleButtonGroup>
        {cut.lines.map((line) => (
          <Button key={line.id} size="small" variant="outlined" href={`/orders/${line.order.code}/print`} target="_blank">
            Phiếu SX {line.order.code}
          </Button>
        ))}
        <Button
          onClick={() => {
            window.close()
            setTimeout(() => navigate('/casting-cuts'), 150)
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
        <Sheet cut={cut} printedBy={user?.fullName || user?.username || ''} />
      </Box>
    </Box>
  )
}

function Sheet({ cut, printedBy }: { cut: CastingCut; printedBy: string }) {
  const url = `${window.location.origin}/casting-cuts/${cut.code}/print`
  const totalQty = cut.lines.reduce((sum, line) => sum + line.qty, 0)
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '3mm', mb: '2mm' }}>
        <Box>
          <Box sx={{ fontSize: '1.6em', fontWeight: 700, color: TITLE_RED }}>PHIẾU CẮT CÂY THÔNG</Box>
          <div>
            Mã phiếu: <b>{cut.code}</b>
          </div>
          <div>Ngày cắt: {formatDateTime(cut.cutAt)}</div>
          <div>Phiếu đúc: {cut.castingSlip?.code ?? cut.castingOrder?.code ?? '—'}</div>
        </Box>
        <QRCodeSVG value={url} size={72} />
      </Box>

      <table>
        <colgroup>
          <col style={{ width: '7%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '18%' }} />
          <col />
          <col style={{ width: '10%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <tbody>
          <tr>
            <Head>STT</Head>
            <Head>Mã đơn</Head>
            <Head>Mã SP</Head>
            <Head>Mô tả</Head>
            <Head>SL phôi</Head>
            <Head>TL phôi (g)</Head>
            <Head>Thợ nhận ký</Head>
          </tr>
          {cut.lines.map((line, index) => (
            <tr key={line.id}>
              <td style={center}>{index + 1}</td>
              <td style={{ fontWeight: 700 }}>{line.order.code}</td>
              <td>{line.order.model3dCode ?? ''}</td>
              <td>{line.order.description}</td>
              <td style={right}>{line.qty}</td>
              <td style={right}>{formatQty(line.weight)}</td>
              <td />
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ fontWeight: 700, textAlign: 'right' }}>
              Tổng phôi → kho BTP
            </td>
            <td style={{ ...right, fontWeight: 700 }}>{totalQty}</td>
            <td style={{ ...right, fontWeight: 700 }}>{formatQty(cut.blankWeight)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <table style={{ marginTop: '2mm' }}>
        <tbody>
          <tr>
            <Head>TL cây sau đúc (g)</Head>
            <Head>Tổng phôi (g)</Head>
            <Head>Còn lại → NVL (g)</Head>
            <Head>Hao hụt cắt (g)</Head>
          </tr>
          <tr>
            <td style={center}>{formatQty(cut.treeWeight)}</td>
            <td style={center}>{formatQty(cut.blankWeight)}</td>
            <td style={center}>{formatQty(cut.restWeight)}</td>
            <td style={{ ...center, fontWeight: 700 }}>{formatQty(cut.lossWeight)}</td>
          </tr>
          {cut.restMaterial ? (
            <tr>
              <td colSpan={4}>
                Phần còn lại nhập mã: {cut.restMaterial.sku ? `${cut.restMaterial.sku} · ` : ''}
                {cut.restMaterial.name}
              </td>
            </tr>
          ) : null}
          {cut.note ? (
            <tr>
              <td colSpan={4}>Ghi chú: {cut.note}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', mt: '4mm', textAlign: 'center', minHeight: '18mm' }}>
        <div>
          <b>Thủ kho</b>
          <div>{cut.cutByName}</div>
        </div>
        <div>
          <b>KCS</b>
        </div>
        <div>
          <b>Thợ nguội</b>
        </div>
      </Box>

      <Box sx={{ mt: '2mm', display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#333' }}>
        <span>Lập lúc {formatDateTime(cut.createdAt)}</span>
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

function Head({ children }: { children: ReactNode }) {
  return <td style={{ background: HEADER_BG, fontWeight: 700, textAlign: 'center' }}>{children}</td>
}
