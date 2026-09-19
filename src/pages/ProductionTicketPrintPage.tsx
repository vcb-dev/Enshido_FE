import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, GlobalStyles, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  getProductionOrderApi,
  markSubTicketPrintedApi,
  markTicketPrintedApi,
  type ProductionOrderDetail,
  type SubTicket,
} from '../api/productionOrders'
import { formatQty } from '../api/inventory'
import { cloudinaryFit } from '../api/uploads'
import {
  formatDateTime,
  orderTicketUrl,
  SILVER_LOSS_TONE,
  STAGE_LABEL,
  STAGES,
  STATUS_META,
  subTicketUrl,
} from '../orders/catalog'
import {
  outcomeLines,
  stageColumns,
  TICKET_HEADER_BG,
  TICKET_OUTCOME_LABEL,
  TICKET_OUTCOMES,
  TICKET_ROWS,
  TICKET_TONE_BG,
} from '../orders/ticketRows'

type Paper = 'A5' | 'A4'

/** Khổ ngang giống mẫu Excel "Phiếu sản xuất". */
const PAPER_WIDTH: Record<Paper, string> = { A5: '210mm', A4: '297mm' }

const BLUE = '#2f5da8'
const TITLE_RED = '#e0403a'

/**
 * Bảng phiếu = 1 cột nhãn + mỗi khâu một cột + 2 cột kết cục (Lỗi / Hoàn thiện). Khối thông tin
 * đầu phiếu chỉ xếp theo 6 ô nên ô cuối mỗi hàng nuốt số cột dư — đổi số khâu là phiếu tự khớp
 * lại, không lệch ô.
 */
const TICKET_COLS = STAGES.length + TICKET_OUTCOMES.length + 1
const SPAN_1 = TICKET_COLS - 5
const SPAN_2 = SPAN_1 + 1
const SPAN_3 = SPAN_1 + 2
/** Cột kết cục rộng hơn cột khâu vì chứa lý do lỗi / thông tin vào kho. */
const OUTCOME_COL_WIDTH = 13
const STAGE_COL_WIDTH = `${((81 - OUTCOME_COL_WIDTH * TICKET_OUTCOMES.length) / STAGES.length).toFixed(2)}%`

/** In phiếu mẹ (`/orders/:code/print`) hoặc phiếu con cho thợ (`/orders/:code/tickets/:no/print`). */
export function ProductionTicketPrintPage() {
  const { code = '', no } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [paper, setPaper] = useState<Paper>('A5')
  const autoPrinted = useRef(false)

  const detail = useQuery({
    queryKey: ['production-order', code],
    queryFn: () => getProductionOrderApi(code),
    staleTime: 0,
  })
  const ticketNo = no != null ? Number(no) : null
  const subTicket = ticketNo != null ? detail.data?.subTickets.find((ticket) => ticket.no === ticketNo) : undefined
  const missingTicket = ticketNo != null && detail.data != null && !subTicket
  // Đơn BTP lấy hàng đúc sẵn nên in được ngay; Đơn NVL in từ bước Đúc.
  const canPrint = !missingTicket && (detail.data?.source === 'BTP' || Boolean(detail.data?.castingSentDate))

  async function print() {
    window.print()
    try {
      if (ticketNo != null) {
        const { lastPrintedAt } = await markSubTicketPrintedApi(code, ticketNo)
        queryClient.setQueryData<ProductionOrderDetail>(['production-order', code], (prev) =>
          prev
            ? {
                ...prev,
                subTickets: prev.subTickets.map((ticket) =>
                  ticket.no === ticketNo ? { ...ticket, lastPrintedAt } : ticket,
                ),
              }
            : prev,
        )
        return
      }
      const { lastPrintedAt } = await markTicketPrintedApi(code)
      queryClient.setQueryData<ProductionOrderDetail>(['production-order', code], (prev) =>
        prev ? { ...prev, lastPrintedAt } : prev,
      )
      void queryClient.invalidateQueries({ queryKey: ['production-orders'] })
    } catch {
      /* in giấy vẫn xong; lần in chỉ không được ghi nhận */
    }
  }

  // Tự mở hộp thoại in khi dữ liệu và ảnh đã sẵn sàng (chờ tối đa 2.5 giây cho ảnh).
  useEffect(() => {
    if (!detail.data || !canPrint || autoPrinted.current) return
    autoPrinted.current = true
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.ticket img'))
    const loaded = Promise.all(
      images.map((img) =>
        img.complete ? Promise.resolve() : new Promise((resolve) => img.addEventListener('load', resolve, { once: true })),
      ),
    )
    const timeout = new Promise((resolve) => setTimeout(resolve, 2500))
    void Promise.race([loaded, timeout]).then(() => print())
  }, [detail.data, canPrint])

  const printStyles = (
    <GlobalStyles
      styles={{
        '@page': { size: `${paper} landscape`, margin: '6mm' },
        '@media print': {
          'html, body, #root': { height: 'auto !important', overflow: 'visible !important', background: '#fff !important' },
          '.ticket-toolbar': { display: 'none !important' },
          '.ticket-screen': { padding: '0 !important', background: '#fff !important', height: 'auto !important', overflow: 'visible !important' },
          '.ticket': { boxShadow: 'none !important', margin: '0 !important', width: 'auto !important', padding: '0 !important' },
        },
      }}
    />
  )

  if (detail.isLoading) {
    return (
      <Stack sx={{ py: 8, alignItems: 'center' }}>
        <CircularProgress size={28} />
      </Stack>
    )
  }
  if (!detail.data || missingTicket) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          {missingTicket
            ? `Không tìm thấy phiếu con ${code}-${no}`
            : detail.error instanceof Error
              ? detail.error.message
              : 'Không tải được đơn sản xuất'}
        </Alert>
      </Box>
    )
  }

  const order = detail.data

  return (
    <Box className="ticket-screen" sx={{ height: '100dvh', overflow: 'auto', bgcolor: '#e5e8eb', px: 2, pb: 3 }}>
      {printStyles}
      <Stack
        className="ticket-toolbar"
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ py: 1.5, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <Button variant="contained" startIcon={<PrintIcon />} disabled={!canPrint} onClick={() => void print()}>
          In phiếu
        </Button>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={paper}
          onChange={(_, value: Paper | null) => value && setPaper(value)}
        >
          <ToggleButton value="A5">A5 ngang</ToggleButton>
          <ToggleButton value="A4">A4 ngang</ToggleButton>
        </ToggleButtonGroup>
        <Button
          onClick={() => {
            // Tab mở bằng link không phải lúc nào cũng tự đóng được — khi đó quay về trang đơn.
            window.close()
            setTimeout(() => navigate(`/orders/${code}`), 150)
          }}
        >
          Đóng
        </Button>
      </Stack>

      {canPrint ? null : (
        <Alert className="ticket-toolbar" severity="warning" sx={{ maxWidth: 720, mx: 'auto', mb: 1.5 }}>
          Đơn {order.code} chưa báo Đúc — chỉ in phiếu cho thợ từ bước Đúc. Báo Đúc trên trang chi tiết đơn trước.
        </Alert>
      )}

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
          fontSize: paper === 'A5' ? '8.5pt' : '11pt',
          lineHeight: 1.2,
          visibility: canPrint ? 'visible' : 'hidden',
          '& table': { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', breakInside: 'avoid' },
          '& th, & td': { border: '0.6pt solid #000', padding: '0.5mm 1.2mm', verticalAlign: 'middle' },
        }}
      >
        <Ticket order={order} subTicket={subTicket} printedBy={user?.fullName || user?.username || ''} />
      </Box>
    </Box>
  )
}

function Ticket({
  order,
  subTicket,
  printedBy,
}: {
  order: ProductionOrderDetail
  subTicket?: SubTicket
  printedBy: string
}) {
  const columns = stageColumns(order.stages, subTicket?.id)
  const ticketIndex = subTicket ? order.subTickets.findIndex((ticket) => ticket.id === subTicket.id) : -1
  const silverWeight = subTicket ? subTicket.silverWeight : order.silverWeight
  const splitNote = subTicket
    ? `Phiếu con của đơn ${order.code} (${order.qty} sp${
        order.silverWeight != null ? ` · ${formatQty(order.silverWeight)} g bạc` : ''
      })`
    : order.subTickets.length
      ? `Phiếu con: ${order.subTickets
          .map((ticket) => `${ticket.code} (${ticket.qty} sp · ${formatQty(ticket.silverWeight)} g)`)
          .join(', ')}`
      : ''
  const productImages = order.images.filter((image) => image.kind === 'PRODUCT')
  const images = (productImages.length ? productImages : order.images).slice(0, 2)

  return (
    <>
      <Box sx={{ position: 'relative', textAlign: 'center', minHeight: '11mm' }}>
        <Box sx={{ color: TITLE_RED, fontWeight: 700, fontSize: '1.45em', pt: '2mm' }}>
          {subTicket ? 'Phiếu sản xuất — phiếu con' : 'Phiếu sản xuất'}
        </Box>
        <Box sx={{ position: 'absolute', right: 0, top: 0, textAlign: 'center' }}>
          <QRCodeSVG
            value={subTicket ? subTicketUrl(subTicket.code) : orderTicketUrl(order.code)}
            size={96}
            marginSize={0}
            style={{ width: '11mm', height: '11mm' }}
          />
        </Box>
      </Box>

      <table style={{ marginTop: '1mm' }}>
        <colgroup>
          <col style={{ width: '19%' }} />
          {STAGES.map((stage) => (
            <col key={stage} style={{ width: STAGE_COL_WIDTH }} />
          ))}
          {TICKET_OUTCOMES.map((outcome) => (
            <col key={outcome} style={{ width: `${OUTCOME_COL_WIDTH}%` }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <Head>Mã Sản xuất:</Head>
            <Head style={{ fontSize: '1.1em' }}>{subTicket ? subTicket.code : order.code}</Head>
            <Head>Ngày đặt đơn:</Head>
            <Head style={{ color: BLUE }}>{ticketDay(order.receivedDate)}</Head>
            <Head>Ngày cần trả:</Head>
            <Head colSpan={SPAN_1} style={{ color: BLUE }}>
              {ticketDay(order.dueDate)}
            </Head>
          </tr>
          <tr>
            {subTicket ? (
              <>
                <td style={center}>Phiếu con</td>
                <td style={center}>
                  {ticketIndex + 1} / {order.subTickets.length}
                </td>
              </>
            ) : (
              <>
                <td style={center}>Phân đơn</td>
                <td style={center}>
                  {order.split.no} / {order.split.total}
                </td>
              </>
            )}
            {order.source === 'BTP' ? (
              <>
                <Label>Mã BTP:</Label>
                <td colSpan={SPAN_3} style={{ ...center, color: BLUE, fontWeight: 700 }}>
                  {order.btp ? `${order.btp.sku ?? ''} · ${order.btp.name}` : order.btpSku}
                </td>
              </>
            ) : (
              <>
                <Label>Ngày báo Đúc:</Label>
                <td style={{ ...center, color: BLUE, fontWeight: 700 }}>{ticketDay(order.castingSentDate)}</td>
                <Label>Ngày Đúc về:</Label>
                <td colSpan={SPAN_1} style={{ ...center, color: BLUE, fontWeight: 700 }}>
                  {ticketDay(order.castingReturnedDate)}
                </td>
              </>
            )}
          </tr>
          <tr>
            <td colSpan={2} rowSpan={7} style={{ padding: '1mm', verticalAlign: 'middle' }}>
              <Box sx={{ display: 'flex', gap: '1.5mm', justifyContent: 'center', alignItems: 'center', height: '26mm' }}>
                {images.map((image) => (
                  <Box
                    key={image.id}
                    component="img"
                    src={cloudinaryFit(image.url, 500)}
                    alt=""
                    sx={{ maxWidth: images.length > 1 ? '48%' : '100%', maxHeight: '26mm', objectFit: 'contain' }}
                  />
                ))}
              </Box>
            </td>
            <Label>Size</Label>
            <Value>{order.sizeLabel}</Value>
            <Label>Loại đá</Label>
            <Value colSpan={SPAN_1}>{order.stoneTypes.join(', ')}</Value>
          </tr>
          <tr>
            <Label>Kích thước</Label>
            <Value>{order.size}</Value>
            <Label>
              Số lượng đá <i>(viên)</i>:
            </Label>
            <Value colSpan={SPAN_1}>{order.stoneCount}</Value>
          </tr>
          <tr>
            <Label>Số lượng:</Label>
            <Value>
              {subTicket ? subTicket.qty : order.qty}
              {order.qtyUnit ? ` ${order.qtyUnit}` : ''}
            </Value>
            <Label>Trọng lượng đá:</Label>
            <Value colSpan={SPAN_1}>{order.stoneWeight != null ? formatQty(order.stoneWeight) : ''}</Value>
          </tr>
          <tr>
            <Label>TL bạc (g):</Label>
            <td style={{ ...center, color: BLUE, fontWeight: 700 }}>
              {silverWeight != null ? formatQty(silverWeight) : ''}
            </td>
            <td colSpan={SPAN_2} style={{ fontSize: '0.9em' }}>
              {splitNote}
            </td>
          </tr>
          <tr>
            <Label>Chất liệu</Label>
            <td style={{ ...center, color: BLUE, fontWeight: 700 }}>{order.mainMaterial ?? ''}</td>
            <td colSpan={SPAN_2} style={{ ...center, fontWeight: 700 }}>
              Nội dung khắc Laser:
            </td>
          </tr>
          <tr>
            <Label>Màu sắc:</Label>
            <Value>{order.platingColor}</Value>
            <td colSpan={SPAN_2} style={{ ...center, whiteSpace: 'pre-wrap' }}>
              {order.laserEngraving ?? ''}
            </td>
          </tr>
          <tr>
            <td style={{ ...center, fontStyle: 'italic', fontWeight: 700 }}>Yêu cầu khác</td>
            <td colSpan={SPAN_3} style={{ whiteSpace: 'pre-wrap' }}>
              {order.otherRequirements ?? ''}
            </td>
          </tr>

          <tr>
            <Head style={{ color: BLUE }}>Quá trình sản xuất</Head>
            {STAGES.map((stage) => {
              const entry = columns[stage].entry
              return (
                <Head key={stage}>
                  {STAGE_LABEL[stage]}
                  {entry && entry.attempt > 1 ? ` (lần ${entry.attempt})` : ''}
                </Head>
              )
            })}
            {TICKET_OUTCOMES.map((outcome) => (
              <Head key={outcome}>{TICKET_OUTCOME_LABEL[outcome]}</Head>
            ))}
          </tr>
          {TICKET_ROWS.map((row, index) => (
            <tr key={row.key} style={row.tone ? { background: TICKET_TONE_BG[row.tone] } : undefined}>
              <td style={{ fontWeight: row.tone ? 700 : 400 }}>
                {row.label}
                {row.hint ? <i style={{ whiteSpace: 'nowrap' }}> {row.hint}</i> : null}
              </td>
              {STAGES.map((stage) => {
                const entry = columns[stage].entry
                const level = entry && row.warnLevel ? row.warnLevel(entry) : null
                return (
                  <td
                    key={stage}
                    style={{
                      textAlign: row.numeric ? 'right' : 'left',
                      height: '4.2mm',
                      // In đen trắng vẫn đọc được mức cảnh báo nhờ chữ đậm.
                      ...(level
                        ? {
                            background: SILVER_LOSS_TONE[level].bg,
                            color: SILVER_LOSS_TONE[level].fg,
                            fontWeight: 700,
                          }
                        : null),
                    }}
                  >
                    {entry ? row.value(entry) : ''}
                  </td>
                )
              })}
              {index === 0
                ? TICKET_OUTCOMES.map((outcome) => (
                    <td
                      key={outcome}
                      rowSpan={TICKET_ROWS.length}
                      style={{ verticalAlign: 'top', whiteSpace: 'pre-line' }}
                    >
                      {outcomeLines(order, outcome, subTicket).join('\n')}
                    </td>
                  ))
                : null}
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ mt: '1.5mm', display: 'flex', justifyContent: 'space-between', gap: '2mm', fontSize: '0.8em', color: '#333' }}>
        <span>
          Trạng thái: {STATUS_META[order.status].label} · Dữ liệu cập nhật lúc {formatDateTime(order.dataChangedAt)}
        </span>
        <span>
          In lúc {formatDateTime(new Date().toISOString())}
          {printedBy ? ` · ${printedBy}` : ''}
        </span>
      </Box>
    </>
  )
}

const center: CSSProperties = { textAlign: 'center' }

/** Ô tiêu đề nền vàng như mẫu. */
function Head({ children, colSpan, style }: { children: ReactNode; colSpan?: number; style?: CSSProperties }) {
  return (
    <td colSpan={colSpan} style={{ background: TICKET_HEADER_BG, fontWeight: 700, textAlign: 'center', ...style }}>
      {children}
    </td>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <td style={{ fontWeight: 700 }}>{children}</td>
}

function Value({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} style={{ textAlign: 'center' }}>
      {children ?? ''}
    </td>
  )
}

/** Ngày trên phiếu: 2026/05/08 như mẫu Excel. */
function ticketDay(value: string | null) {
  return value ? value.replaceAll('-', '/') : ''
}
