/**
 * Hệ thống chưa có realtime (WebSocket / SSE): trạng thái phiếu do người khác đổi — thợ quét QR
 * nhận hàng, QC cân, thủ kho xác nhận, thợ đúc báo xong — chỉ hiện khi màn tự làm mới. Mọi màn
 * theo dõi trạng thái dùng chung các mức dưới đây thay vì tự đặt số, để chỉnh một chỗ là đủ.
 * Thao tác trên chính máy đã vá cache tức thì (orderCache, useOrderMutation) — poll chỉ để thấy
 * thay đổi từ máy khác, nên các mức để thưa cho đỡ tải máy chủ.
 */
export const LIVE_REFRESH_MS = {
  /** Đang điều hành cùng lúc với người khác: tab Sản xuất của đơn (phiếu con đổi trạng thái). */
  active: 15_000,
  /** Phiếu thợ đang cầm / mở từ QR. */
  ticket: 20_000,
  /** Danh sách theo trạng thái: lệnh SX, lệnh đúc, đơn tạo, hàng chờ kho, phiếu xuất nháp. */
  list: 30_000,
  /** Bộ đếm trên tab. */
  background: 60_000,
} as const

/**
 * Tuỳ chọn useQuery cho màn theo dõi trạng thái: làm mới theo chu kỳ khi tab đang mở (tab ẩn
 * thì dừng cho đỡ tải máy chủ) và làm mới ngay khi người dùng quay lại tab — mặc định của app
 * tắt làm mới khi quay lại tab. `false` = màn không cần theo dõi.
 */
export function liveRefresh(intervalMs: number | false) {
  return {
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: intervalMs !== false,
  } as const
}
