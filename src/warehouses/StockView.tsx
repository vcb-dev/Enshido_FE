import { useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { formatMoney, formatQty, type AvailabilityCode, type MaterialImage, type StockRow } from '../api/inventory'
import { cloudinaryFit, cloudinaryThumb } from '../api/uploads'
import { DETAIL_GRID, DetailFact, DetailSection } from './detailView'
import { StockFigureGrid } from './StockFigureGrid'
import type { StockProfile } from './catalog'

export function WarehouseStockView({
  row,
  profile,
  onClose,
}: {
  row: StockRow
  profile: StockProfile
  onClose: () => void
}) {
  const facts = stockFacts(row, profile)
  const images = row.images ?? []

  return (
    <>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="span" variant="h6" sx={{ fontWeight: 700, display: 'block' }}>
          Chi tiết {row.name || profile.noun}
        </Typography>
        {row.sku ? (
          <Typography variant="body2" color="text.secondary">
            {row.sku}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 0.5 }}>
        <Paper variant="outlined" sx={{ p: 1.75 }}>
          <DetailSection>{profile.noun}</DetailSection>
          <Box sx={DETAIL_GRID}>
            {facts.map((item) => (
              <DetailFact key={item.label} label={item.label} value={item.value} />
            ))}
          </Box>
          {row.note?.trim() ? <DetailFact label="Ghi chú" value={row.note} /> : null}
        </Paper>

        {profile.showProductInfo ? (
          <Paper variant="outlined" sx={{ p: 1.75 }}>
            <DetailSection>Ảnh sản phẩm</DetailSection>
            {images.length ? (
              <ImageThumbs images={images} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Chưa có ảnh
              </Typography>
            )}
          </Paper>
        ) : null}

        <Paper variant="outlined" sx={{ p: 1.75 }}>
          <DetailSection>Số liệu tồn</DetailSection>
          <StockFigureGrid
            values={{
              openingQty: row.openingQty,
              openingAmount: row.openingAmount,
              inQty: row.inQty,
              inAmount: row.inAmount,
              outQty: row.outQty,
              outAmount: row.outAmount,
              qty: row.qty,
              amount: row.amount,
            }}
            notes
          />
          <Typography variant="body2" sx={{ color: '#1e8449', fontWeight: 600, mt: 1.5 }}>
            Tồn = Tồn đầu kỳ + Nhập − Xuất. SL {formatQty(row.qty)} · TT {formatMoney(row.amount)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            TT đầu kỳ = SL × đơn giá tồn. Nhập / xuất / tồn kho lấy từ phiếu, không sửa tay.
          </Typography>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Đóng
        </Button>
      </DialogActions>
    </>
  )
}

function stockFacts(row: StockRow, profile: StockProfile) {
  const items: Array<{ label: string; value: ReactNode; show?: boolean }> = [
    { label: profile.skuLabel, value: row.sku, show: profile.showSku },
    { label: profile.nameLabel, value: row.name },
    { label: 'Vị trí', value: row.locationCode, show: profile.showLocation },
    { label: profile.categoryLabel, value: row.metalKindLabel, show: profile.showNvlCategory },
    { label: 'Danh mục BTP', value: row.otherClass, show: profile.showBtpCategory },
    { label: profile.typeLabel, value: typeText(row, profile), show: profile.showType },
    { label: 'Chất liệu', value: row.bodyMetal, show: profile.showBodyMetal },
    { label: 'Phân loại sản phẩm', value: row.productKind, show: profile.showProductKind },
    { label: 'Hình dạng', value: row.shape, show: profile.showShapeColor },
    { label: 'Màu sắc', value: row.color, show: profile.showShapeColor },
    { label: 'Màu xi', value: row.platingColor, show: profile.showProductInfo },
    { label: 'Màu đá', value: row.color, show: profile.showProductInfo },
    { label: 'Size', value: row.sizeLabel, show: profile.showSize || profile.showProductInfo },
    { label: 'Đơn vị', value: row.unit },
    { label: 'Đơn giá tồn', value: formatMoney(row.stockUnitPrice) },
    {
      label: 'Trạng thái',
      value: (
        <Chip
          size="small"
          variant="outlined"
          color={availabilityColor(row.availability)}
          label={row.availabilityLabel}
        />
      ),
      show: profile.showStatus,
    },
  ]
  return items.filter((item) => item.show !== false)
}

function typeText(row: StockRow, profile: StockProfile) {
  if (profile.typeCodes) return row.otherClass ?? row.otherClassParent ?? row.materialType ?? ''
  return row.materialType ?? ''
}

function availabilityColor(code: AvailabilityCode) {
  if (code === 'IN_STOCK') return 'success' as const
  if (code === 'LOW') return 'warning' as const
  return 'error' as const
}

function ImageThumbs({ images }: { images: MaterialImage[] }) {
  const [preview, setPreview] = useState<MaterialImage | null>(null)
  return (
    <>
      <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
        {images.map((image) => (
          <Box
            key={image.publicId}
            component="button"
            type="button"
            aria-label="Xem ảnh"
            onClick={() => setPreview(image)}
            sx={{
              width: 72,
              height: 72,
              p: 0,
              border: 0,
              bgcolor: 'transparent',
              cursor: 'zoom-in',
            }}
          >
            <Box
              component="img"
              src={cloudinaryThumb(image.url, 144)}
              alt=""
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 0.5,
                border: '1px solid #d5dbe0',
              }}
            />
          </Box>
        ))}
      </Stack>
      <Dialog
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: '#111', boxShadow: 'none', overflow: 'hidden' } } }}
      >
        <IconButton
          aria-label="Đóng"
          onClick={() => setPreview(null)}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            color: '#fff',
            bgcolor: 'rgba(0,0,0,0.45)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <CloseIcon />
        </IconButton>
        {preview ? (
          <Box
            component="img"
            src={cloudinaryFit(preview.url, 1400)}
            alt="Xem trước ảnh"
            sx={{ display: 'block', width: '100%', maxHeight: '86vh', objectFit: 'contain', bgcolor: '#111' }}
          />
        ) : null}
      </Dialog>
    </>
  )
}
