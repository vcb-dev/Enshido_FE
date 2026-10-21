import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Alert, Box, Button, GlobalStyles, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
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
import { PrintSheetSkeleton } from '../components/ui'
import { cloudinaryFit } from '../api/uploads'
import {
  formatDateTime,
  parentWorkTicketUrl,
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
  PRINT_TICKET_ROWS,
  TICKET_TONE_BG,
} from '../orders/ticketRows'

type Paper = 'A5' | 'A4'

/** Khổ ngang giống mẫu Excel "Phiếu sản xuất". */
const PAPER_WIDTH: Record<Paper, string> = { A5: '210mm', A4: '297mm' }

const BLUE = '#2f5da8'
const TITLE_RED = '#e0403a'

/**
 * Bảng phiếu = 1 cột nhãn + mỗi khâu một cột + các cột kết cục (Lỗi / Hoàn thiện — phiếu không
 * có lỗi thì bỏ cột Lỗi). Khối thông tin đầu phiếu chỉ xếp theo 6 ô nên ô cuối mỗi hàng nuốt số
 * cột dư — đổi số khâu / số cột kết cục là phiếu tự khớp lại, không lệch ô.
 */
function ticketLayout(outcomeCount: number) {
  const span1 = STAGES.length + outcomeCount + 1 - 5
  return {
    span1,
    span2: span1 + 1,
    span3: span1 + 2,
    stageColWidth: `${((81 - OUTCOME_COL_WIDTH * outcomeCount) / STAGES.length).toFixed(2)}%`,
  }
}
/** Cột kết cục rộng hơn cột khâu vì chứa lý do lỗi / thông tin vào kho. */
const OUTCOME_COL_WIDTH = 13

/**
 * In phiếu mẹ (`/orders/:code/print`), một phiếu con (`/orders/:code/tickets/:no/print`) hoặc
 * mọi phiếu con của đơn, mỗi phiếu một trang (`/orders/:code/tickets/print-all`). Mã QR chỉ nằm
 * trên phiếu con — thợ quét là vào đúng phiếu đó để nhận việc và báo xong từng khâu.
 */
export function ProductionTicketPrintPage({ all = false }: { all?: boolean }) {
  const { code = '', no } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  // A4 ngang mặc định: chữ to nhất mà phiếu vẫn nằm gọn một tờ (A5 không đủ chỗ cho bảng khâu).
  const [paper, setPaper] = useState<Paper>('A4')
  const autoPrinted = useRef(false)

  const detail = useQuery({
    queryKey: ['production-order', code],
    queryFn: () => getProductionOrderApi(code),
    staleTime: 0,
  })
  const ticketNo = no != null ? Number(no) : null
  const subTicket = ticketNo != null ? detail.data?.subTickets.find((ticket) => ticket.no === ticketNo) : undefined
  const missingTicket =
    (ticketNo != null && detail.data != null && !subTicket) ||
    (all && detail.data != null && detail.data.subTickets.length === 0)
  // Đơn BTP lấy hàng đúc sẵn nên in được ngay; Đơn NVL in từ bước Đúc.
  const canPrint =
    !missingTicket &&
    (detail.data?.source === 'BTP' || Boolean(detail.data?.castingSentDate || detail.data?.cutAt))

  async function print() {
    window.print()
    try {
      if (all) {
        const stamps = await Promise.all(
          (detail.data?.subTickets ?? []).map(async (ticket) => ({
            no: ticket.no,
            lastPrintedAt: (await markSubTicketPrintedApi(code, ticket.no)).lastPrintedAt,
          })),
        )
        queryClient.setQueryData<ProductionOrderDetail>(['production-order', code], (prev) =>
          prev
            ? {
                ...prev,
                subTickets: prev.subTickets.map((ticket) => {
                  const stamp = stamps.find((item) => item.no === ticket.no)
                  return stamp ? { ...ticket, lastPrintedAt: stamp.lastPrintedAt } : ticket
                }),
              }
            : prev,
        )
        return
      }
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

  if (detail.isLoading) return <PrintSheetSkeleton />
  if (!detail.data || missingTicket) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          {missingTicket
            ? all
              ? `Đơn ${code} chưa chia phiếu con`
              : `Không tìm thấy phiếu con ${code}-${no}`
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
          {all ? `In ${order.subTickets.length} phiếu con` : 'In phiếu'}
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
          Đơn {order.code} chưa cắt cây thông — chỉ in phiếu cho thợ sau khi cắt cây thông.
        </Alert>
      )}

      {(all ? order.subTickets : [subTicket]).map((ticket, index, list) => (
        <Box
          key={ticket?.id ?? 'parent'}
          className="ticket"
          sx={{
            width: PAPER_WIDTH[paper],
            maxWidth: '100%',
            mx: 'auto',
            mb: all ? 2 : 0,
            p: '6mm',
            bgcolor: '#fff',
            color: '#000',
            boxShadow: '0 1px 6px rgba(0,0,0,.2)',
            fontFamily: '"Times New Roman", Times, serif',
            // 12,5pt là cỡ lớn nhất phiếu tổng (có cột Lỗi) còn vừa một tờ A4 ngang — to hơn là tràn trang.
            fontSize: paper === 'A5' ? '8.5pt' : '12.5pt',
            lineHeight: 1.2,
            visibility: canPrint ? 'visible' : 'hidden',
            // Mỗi phiếu con một trang giấy.
            '@media print': { breakAfter: index === list.length - 1 ? 'auto' : 'page', mb: 0 },
            '& table': { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', breakInside: 'avoid' },
            '& th, & td': { border: '0.6pt solid #000', padding: '0.5mm 1.2mm', verticalAlign: 'middle' },
          }}
        >
          <Ticket order={order} subTicket={ticket} printedBy={user?.fullName || user?.username || ''} />
        </Box>
      ))}
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
  const outcomes = TICKET_OUTCOMES.map((outcome) => ({
    outcome,
    lines: outcomeLines(order, outcome, subTicket),
  })).filter((item) => item.outcome !== 'DEFECT' || item.lines.length > 0)
  const { span1: SPAN_1, span2: SPAN_2, span3: SPAN_3, stageColWidth } = ticketLayout(outcomes.length)
  const ticketIndex = subTicket ? order.subTickets.findIndex((ticket) => ticket.id === subTicket.id) : -1
  const materials = subTicket ? subTicket.materials : order.materials
  // Phiếu con đã chốt Hoàn thiện mang trạng thái "Đã xi xong" của luồng — trên giấy ghi theo kết cục.
  const statusLabel =
    subTicket?.outcome === 'FINISH'
      ? TICKET_OUTCOME_LABEL.FINISH
      : STATUS_META[subTicket ? subTicket.status : order.status].label
  // Kho nhập thành phẩm không đổi mốc dữ liệu của đơn — lấy mốc muộn hơn để chân phiếu không cũ.
  const stockedAt = order.finishedGoods?.receivedAt
  const dataChangedAt = stockedAt && stockedAt > order.dataChangedAt ? stockedAt : order.dataChangedAt
  const splitNote = subTicket
    ? `Phiếu con của đơn ${order.code} (${order.qty} sp)`
    : order.subTickets.length
      ? `Phiếu con: ${order.subTickets.map((ticket) => `${ticket.code} (${ticket.qty} sp)`).join(', ')}`
      : ''
  const issuedNote = [
    materials.lines
      .map(
        (line) =>
          `${line.sku || line.name} ${formatQty(line.qty)} ${line.unit}${line.weight ? ` (${formatQty(line.weight)} g)` : ''}`,
      )
      .join('; '),
    materials.silverLoss != null
      ? `Hao hụt bạc ${formatQty(materials.silverLoss)} g${materials.silverLossPercent != null ? ` (${formatQty(materials.silverLossPercent)}%)` : ''}`
      : '',
    materials.stoneLoss ? `Mất ${materials.stoneLoss} viên đá` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const productImages = order.images.filter((image) => image.kind === 'PRODUCT')
  const images = (productImages.length ? productImages : order.images).slice(0, 2)

  return (
    <>
      <Box sx={{ position: 'relative', textAlign: 'center', minHeight: subTicket || order.subTickets.length === 0 ? '21mm' : '11mm' }}>
        <Box sx={{ color: TITLE_RED, fontWeight: 700, fontSize: '1.45em', pt: '2mm' }}>
          {subTicket ? 'Phiếu sản xuất — phiếu con' : 'Phiếu sản xuất'}
        </Box>
        {/* Đơn đã chia: mã QR nằm trên từng phiếu con, phiếu tổng không có QR. Đơn chưa chia
            (BTP, đơn cũ) thợ vẫn quét QR của chính phiếu mẹ. */}
        {subTicket || order.subTickets.length === 0 ? (
          <Box sx={{ position: 'absolute', right: 0, top: 0, textAlign: 'center' }}>
            <QRCodeSVG
              value={subTicket ? subTicketUrl(subTicket.code) : parentWorkTicketUrl(order.code)}
              size={128}
              marginSize={0}
              style={{ width: '17mm', height: '17mm' }}
            />
            <Box sx={{ fontSize: '0.75em', fontWeight: 700 }}>{subTicket ? subTicket.code : order.code}</Box>
          </Box>
        ) : null}
      </Box>

      <table style={{ marginTop: '1mm' }}>
        <colgroup>
          <col style={{ width: '19%' }} />
          {STAGES.map((stage) => (
            <col key={stage} style={{ width: stageColWidth }} />
          ))}
          {outcomes.map(({ outcome }) => (
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
            <td colSpan={2} rowSpan={6} style={{ padding: '1mm', verticalAlign: 'middle' }}>
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
            <Label>Kích thước</Label>
            <Value colSpan={SPAN_1}>{order.size}</Value>
          </tr>
          <tr>
            <Label>Số lượng:</Label>
            <Value>
              {subTicket ? subTicket.qty : order.qty}
              {order.qtyUnit ? ` ${order.qtyUnit}` : ''}
            </Value>
            <Label>Trọng lượng:</Label>
            <Value colSpan={SPAN_1}>{order.weight != null ? formatQty(order.weight) : ''}</Value>
          </tr>
          <tr>
            <Label>Bạc xuất thêm (g):</Label>
            <td style={{ ...center, color: BLUE, fontWeight: 700 }}>
              {Number(materials.issuedSilverWeight ?? 0) ? formatQty(materials.issuedSilverWeight ?? '0') : ''}
            </td>
            <td colSpan={SPAN_2} style={{ fontSize: '0.9em' }}>
              {[splitNote, issuedNote].filter(Boolean).join(' — ')}
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
            {outcomes.map(({ outcome }) => (
              <Head key={outcome}>{TICKET_OUTCOME_LABEL[outcome]}</Head>
            ))}
          </tr>
          {PRINT_TICKET_ROWS.map((row, index) => (
            <tr key={row.key} style={row.tone ? { background: TICKET_TONE_BG[row.tone] } : undefined}>
              <td style={{ fontWeight: row.tone ? 700 : 400, ...(row.parts ? splitCell : null) }}>
                {row.parts ? (
                  <Box sx={{ display: 'flex', height: '100%' }}>
                    <Box sx={{ flex: 1, padding: '0.5mm 1.2mm', alignSelf: 'center' }}>
                      {row.label}
                      {row.hint ? <i style={{ whiteSpace: 'nowrap' }}> {row.hint}</i> : null}
                    </Box>
                    <SplitStack cells={row.parts.map((part) => part.label)} bordered />
                  </Box>
                ) : (
                  <>
                    {row.label}
                    {row.hint ? <i style={{ whiteSpace: 'nowrap' }}> {row.hint}</i> : null}
                  </>
                )}
              </td>
              {STAGES.map((stage) => {
                const entry = columns[stage].entry
                if (row.parts) {
                  return (
                    <td key={stage} style={splitCell}>
                      <SplitStack cells={row.parts.map((part) => (entry ? part.value(entry) : ''))} alignRight />
                    </td>
                  )
                }
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
                ? outcomes.map(({ outcome, lines }) => (
                    <td
                      key={outcome}
                      rowSpan={PRINT_TICKET_ROWS.length}
                      style={{ verticalAlign: 'top', whiteSpace: 'pre-line' }}
                    >
                      {lines.join('\n')}
                    </td>
                  ))
                : null}
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ mt: '1.5mm', display: 'flex', justifyContent: 'space-between', gap: '2mm', fontSize: '0.8em', color: '#333' }}>
        <span>
          Trạng thái: {statusLabel} · Dữ liệu cập nhật lúc{' '}
          {formatDateTime(dataChangedAt)}
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

/** Ô chia đôi (Trọng lượng giao: S925 trên / BTP dưới) — đường kẻ giữa cùng nét với bảng. */
const SPLIT_BORDER = '0.6pt solid #000'
/**
 * `height: 1px` cho ô bảng để phần trong lấy được `height: 100%` = chiều cao thật của hàng —
 * ô nhãn xuống 2 dòng thì các nửa trong ô khâu giãn theo, đường kẻ giữa thẳng hàng.
 */
const splitCell: CSSProperties = { padding: 0, height: '1px' }

/** Chồng các nửa bằng nhau theo chiều dọc, kẻ ngang giữa các nửa. */
function SplitStack({ cells, alignRight, bordered }: { cells: string[]; alignRight?: boolean; bordered?: boolean }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: bordered ? SPLIT_BORDER : 'none' }}>
      {cells.map((cell, index) => (
        <Box
          key={index}
          sx={{
            flex: '1 1 0',
            minHeight: '4.2mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: alignRight ? 'flex-end' : 'flex-start',
            padding: '0.5mm 1.2mm',
            borderTop: index ? SPLIT_BORDER : 'none',
          }}
        >
          {cell}
        </Box>
      ))}
    </Box>
  )
}

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
