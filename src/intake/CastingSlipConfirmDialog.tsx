import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type {
  CastingSlip,
  ConfirmCastingSlipPayload,
} from "../api/castingSlips";
import { listRestMaterialOptionsApi } from "../api/castingSlips";
import { formatQty, parseQtyInput } from "../api/inventory";
import type { OrderImage } from "../api/productionOrders";
import { QtyTextField } from "../components/ui/QtyTextField";
import { ImageUploadField } from "../orders/ImageUploadField";
import { SILVER_LOSS_LIMITS, silverLossLevel } from "../orders/catalog";
import { confirmWeights, ratioWarning } from "../orders/weightSanity";

const LOSS_SEVERITY = { ok: "success", warn: "warning", high: "error" } as const;

type Blank = { qty: string; weight: string; images: OrderImage[] };

function positive(raw: string, allowZero = false) {
  const parsed = parseQtyInput(raw.trim());
  const value = parsed ? Number(parsed) : NaN;
  return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
    ? value
    : null;
}

/** Cân từng phần phôi ngay lúc xác nhận đúc; mỗi phần sẽ nằm trên lệnh sản xuất tương ứng. */
export function CastingSlipConfirmDialog({
  slip,
  saving,
  onClose,
  onSave,
}: {
  slip: CastingSlip | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: ConfirmCastingSlipPayload) => void;
}) {
  const [blanks, setBlanks] = useState<Record<string, Blank>>({});
  const [restWeight, setRestWeight] = useState("0");
  const [restMaterialId, setRestMaterialId] = useState("");
  const [restImages, setRestImages] = useState<OrderImage[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const restMaterials = useQuery({
    queryKey: ["casting-rest-materials"],
    queryFn: listRestMaterialOptionsApi,
    enabled: Boolean(slip),
    staleTime: 60_000,
  });

  useEffect(() => {
    setBlanks(
      Object.fromEntries(
        (slip?.orders ?? []).map((line) => [
          line.intakeOrderId,
          {
            qty: String(line.qty),
            weight: "",
            images: [],
          },
        ]),
      ),
    );
    setRestWeight("0");
    setRestMaterialId("");
    setRestImages([]);
    setUploading({});
    setError("");
  }, [slip]);

  function change(id: string, patch: Partial<Blank>) {
    setBlanks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  /**
   * Hao hụt cắt — cùng công thức các khâu: vào (cây sau đúc) − ra (phôi các đơn) − thu hồi
   * (phần cây còn lại về kho NVL); % tính trên cây sau đúc, màu theo ngưỡng hao hụt bạc.
   */
  const tree = Number(slip?.castTreeWeightGram ?? 0);
  const blankTotal = (slip?.orders ?? []).reduce(
    (sum, order) => sum + (positive(blanks[order.intakeOrderId]?.weight ?? "") ?? 0),
    0,
  );
  const restValue = positive(restWeight, true) ?? 0;
  const cutLoss = tree > 0 && blankTotal > 0
    ? {
        value: Math.round((tree - blankTotal - restValue) * 10000) / 10000,
        percent: ((tree - blankTotal - restValue) / tree) * 100,
      }
    : null;
  const cutLevel = cutLoss ? (silverLossLevel(cutLoss.percent.toFixed(2)) ?? "ok") : "ok";

  async function submit() {
    if (!slip) return;
    const lines: ConfirmCastingSlipPayload["blanks"] = [];
    let total = 0;
    for (const order of slip.orders) {
      const blank = blanks[order.intakeOrderId];
      const qty = Number(blank?.qty);
      const weightGram = positive(blank?.weight ?? "");
      if (
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > order.qty ||
        weightGram == null
      ) {
        return setError(
          `Nhập số phôi và trọng lượng hợp lệ cho đơn ${order.code}`,
        );
      }
      if (!blank.images.length)
        return setError(`Chụp ảnh cân phôi đơn ${order.code}`);
      total += weightGram;
      lines.push({
        intakeOrderId: order.intakeOrderId,
        qty,
        weightGram,
        images: blank.images.map(({ url, publicId, width, height }) => ({
          url,
          publicId,
          width,
          height,
        })),
      });
    }
    const rest = positive(restWeight, true);
    if (rest == null) return setError("Nhập trọng lượng phần cây còn lại");
    if (rest > 0 && !restImages.length)
      return setError("Chụp ảnh cân phần cây còn lại");
    const tree = Number(slip.castTreeWeightGram);
    if (total + rest > tree + 0.000001) {
      return setError(
        `Tổng phôi và phần còn lại vượt trọng lượng cây sau đúc (${formatQty(String(tree))} g)`,
      );
    }
    setError("");
    if (
      !(await confirmWeights([
        ratioWarning(total + rest, "Phôi + phần còn lại", tree, "cây sau đúc", {
          min: 0.5,
          max: 1,
          note: "hao hụt cắt trên 50%",
        }),
      ]))
    ) {
      return;
    }
    onSave({
      blanks: lines,
      restWeightGram: rest,
      restMaterialId: restMaterialId || null,
      restImages: restImages.map(({ url, publicId, width, height }) => ({
        url,
        publicId,
        width,
        height,
      })),
    });
  }

  const busy = saving || Object.values(uploading).some(Boolean);
  return (
    <Dialog
      open={Boolean(slip)}
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Xác nhận đúc và chuyển Nguội — {slip?.code}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            Cây thông sau đúc:{" "}
            <strong>{formatQty(slip?.castTreeWeightGram ?? "0")} g</strong>. Cân
            phôi từng đơn; khi lưu, hệ thống tạo lệnh sản xuất và nhập phôi vào
            kho BTP.
          </Typography>
          {slip?.orders.map((order) => {
            const blank = blanks[order.intakeOrderId];
            return (
              <Paper
                key={order.intakeOrderId}
                variant="outlined"
                sx={{ p: 1.5 }}
              >
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    {order.code} · {order.productName} · cần {order.qty} sản
                    phẩm
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <QtyTextField
                      label="Số phôi"
                      value={blank?.qty ?? ""}
                      onChange={(qty) => change(order.intakeOrderId, { qty })}
                      disabled={busy}
                      fullWidth
                    />
                    <QtyTextField
                      label="Trọng lượng phôi (g)"
                      value={blank?.weight ?? ""}
                      onChange={(weight) =>
                        change(order.intakeOrderId, { weight })
                      }
                      disabled={busy}
                      fullWidth
                    />
                  </Stack>
                  <ImageUploadField
                    label="Ảnh cân phôi"
                    kind="CUT_BLANK"
                    value={blank?.images ?? []}
                    onChange={(images) =>
                      change(order.intakeOrderId, { images })
                    }
                    onUploadingChange={(value) =>
                      setUploading((prev) => ({
                        ...prev,
                        [order.intakeOrderId]: value,
                      }))
                    }
                    readOnly={saving}
                  />
                </Stack>
              </Paper>
            );
          })}
          <QtyTextField
            label="Phần cây còn lại (g)"
            value={restWeight}
            onChange={setRestWeight}
            disabled={busy}
            fullWidth
          />
          {Number(restWeight) > 0 ? (
            <Stack spacing={1}>
              <TextField
                select
                label="NVL nhận phần cây còn lại"
                size="small"
                value={restMaterialId}
                onChange={(event) => setRestMaterialId(event.target.value)}
                disabled={busy}
                fullWidth
              >
                <MenuItem value="">
                  {restMaterials.data?.defaultName ??
                    "Bạc thu hồi / đầu cây S925"}{" "}
                  (mặc định)
                </MenuItem>
                {(restMaterials.data?.items ?? [])
                  .filter(
                    (item) => item.name !== restMaterials.data?.defaultName,
                  )
                  .map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.sku ? `${item.sku} · ` : ""}
                      {item.name}
                    </MenuItem>
                  ))}
              </TextField>
              <ImageUploadField
                label="Ảnh phần cây còn lại"
                kind="CASTING_TREE"
                value={restImages}
                onChange={setRestImages}
                onUploadingChange={(value) =>
                  setUploading((prev) => ({ ...prev, rest: value }))
                }
                readOnly={saving}
              />
            </Stack>
          ) : null}
          {cutLoss ? (
            <Alert severity={LOSS_SEVERITY[cutLevel]} sx={{ py: 0.25 }}>
              <Typography variant="body2">
                Hao hụt cắt: <b>{formatQty(String(cutLoss.value))} g</b> (
                {cutLoss.percent.toFixed(2)}%) = cây sau đúc {formatQty(String(tree))} g − phôi{" "}
                {formatQty(String(blankTotal))} g − phần còn lại {formatQty(String(restValue))} g
                {cutLevel !== "ok"
                  ? ` — vượt ngưỡng ${cutLevel === "high" ? SILVER_LOSS_LIMITS.warn : SILVER_LOSS_LIMITS.ok}%, cân lại phôi / phần còn lại trước khi lưu`
                  : ""}
              </Typography>
            </Alert>
          ) : null}
          {error ? (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Hủy
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy || !slip}>
          {saving ? "Đang lưu…" : "Xác nhận và chuyển Nguội"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
