import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type {
  CastingSlip,
  ConfirmCastingSlipPayload,
} from "../api/castingSlips";
import { listRestMaterialOptionsApi } from "../api/castingSlips";
import { formatQty } from "../api/inventory";
import type { OrderImage } from "../api/productionOrders";
import { DialogForm, FormQtyField, FormSelect } from "../components/ui";
import { FormImageField } from "../orders/FormImageField";
import { SILVER_LOSS_LIMITS, silverLossLevel } from "../orders/catalog";
import { confirmWeights, ratioWarning } from "../orders/weightSanity";

const LOSS_SEVERITY = { ok: "success", warn: "warning", high: "error" } as const;

type Blank = { qty: string; weight: string; images: OrderImage[] };

type Values = {
  /** Phôi theo id đơn tạo trên phiếu đúc. */
  blanks: Record<string, Blank>;
  restWeight: string;
  restMaterialId: string;
  restImages: OrderImage[];
};

/** Số đã chuẩn hoá bởi FormQtyField; `null` khi trống / âm (hoặc bằng 0 nếu không cho phép). */
function positive(raw: string | undefined, allowZero = false) {
  const value = raw?.trim() ? Number(raw) : NaN;
  return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
    ? value
    : null;
}

function valuesOf(slip: CastingSlip | null): Values {
  return {
    blanks: Object.fromEntries(
      (slip?.orders ?? []).map((line) => [
        line.intakeOrderId,
        { qty: String(line.qty), weight: "", images: [] },
      ]),
    ),
    restWeight: "0",
    restMaterialId: "",
    restImages: [],
  };
}

const stripImage = ({ url, publicId, width, height }: OrderImage) => ({
  url,
  publicId,
  width,
  height,
});

/** Cắt cây thông: cân từng phần phôi; mỗi phần sẽ nằm trên lệnh sản xuất tương ứng. */
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
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const form = useForm<Values>({ defaultValues: valuesOf(null) });
  const restMaterials = useQuery({
    queryKey: ["casting-rest-materials"],
    queryFn: listRestMaterialOptionsApi,
    enabled: Boolean(slip),
    staleTime: 60_000,
  });

  useEffect(() => {
    form.reset(valuesOf(slip));
    setUploading({});
  }, [slip, form]);

  const [blanks, restWeight] = useWatch({
    control: form.control,
    name: ["blanks", "restWeight"],
  });

  /**
   * Hao hụt cắt — cùng công thức các khâu: vào (cây sau đúc) − ra (phôi các đơn) − thu hồi
   * (phần cây còn lại về kho NVL); % tính trên cây sau đúc, màu theo ngưỡng hao hụt bạc.
   */
  const tree = Number(slip?.castTreeWeightGram ?? 0);
  const blankTotal = (slip?.orders ?? []).reduce(
    (sum, order) => sum + (positive(blanks?.[order.intakeOrderId]?.weight) ?? 0),
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
  const rootError = form.formState.errors.root?.message;

  async function submit(values: Values) {
    if (!slip) return;
    const lines: ConfirmCastingSlipPayload["blanks"] = slip.orders.map((order) => {
      const blank = values.blanks[order.intakeOrderId];
      return {
        intakeOrderId: order.intakeOrderId,
        qty: Number(blank.qty),
        weightGram: positive(blank.weight)!,
        images: blank.images.map(stripImage),
      };
    });
    const total = lines.reduce((sum, line) => sum + line.weightGram, 0);
    const rest = positive(values.restWeight, true)!;
    if (total + rest > tree + 0.000001) {
      form.setError("root", {
        message: `Tổng phôi và phần còn lại vượt trọng lượng cây sau đúc (${formatQty(String(tree))} g)`,
      });
      return;
    }
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
      restMaterialId: values.restMaterialId || null,
      restImages: rest > 0 ? values.restImages.map(stripImage) : [],
    });
  }

  const busy = saving || Object.values(uploading).some(Boolean);
  const restOptions = [
    {
      value: "",
      label: `${restMaterials.data?.defaultName ?? "Bạc thu hồi / đầu cây S925"} (mặc định)`,
    },
    ...(restMaterials.data?.items ?? [])
      .filter((item) => item.name !== restMaterials.data?.defaultName)
      .map((item) => ({
        value: item.id,
        label: `${item.sku ? `${item.sku} · ` : ""}${item.name}`,
      })),
  ];
  return (
    <Dialog
      open={Boolean(slip)}
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Cắt cây thông — {slip?.code}</DialogTitle>
      <DialogForm form={form} onSubmit={submit}>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="warning" sx={{ py: 0.25 }}>
              Cắt xong không báo lỗi đúc được nữa. Kết quả sai thì bấm <strong>Lỗi đúc</strong>.
            </Alert>
            <Typography variant="body2">
              Cây thông sau đúc:{" "}
              <strong>{formatQty(slip?.castTreeWeightGram ?? "0")} g</strong>. Cân
              phôi từng đơn; khi lưu, hệ thống tạo lệnh sản xuất và nhập phôi vào
              kho BTP.
            </Typography>
            {slip?.orders.map((order) => (
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
                    <FormQtyField<Values>
                      name={`blanks.${order.intakeOrderId}.qty`}
                      label="Số phôi"
                      rules={{
                        validate: (value) => {
                          const qty = Number(value);
                          return Number.isInteger(qty) && qty >= 1 && qty <= order.qty
                            ? true
                            : `Số phôi từ 1 đến ${order.qty}`;
                        },
                      }}
                      disabled={busy}
                      fullWidth
                    />
                    <FormQtyField<Values>
                      name={`blanks.${order.intakeOrderId}.weight`}
                      label="Trọng lượng phôi (g)"
                      rules={{
                        validate: (value) =>
                          positive(String(value ?? "")) == null
                            ? `Nhập trọng lượng phôi đơn ${order.code}`
                            : true,
                      }}
                      disabled={busy}
                      fullWidth
                    />
                  </Stack>
                  <FormImageField<Values>
                    name={`blanks.${order.intakeOrderId}.images`}
                    label="Ảnh cân phôi"
                    kind="CUT_BLANK"
                    required
                    requiredMessage={`Chụp ảnh cân phôi đơn ${order.code}`}
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
            ))}
            <FormQtyField<Values>
              name="restWeight"
              label="Phần cây còn lại (g)"
              rules={{
                validate: (value) =>
                  positive(String(value ?? ""), true) == null
                    ? "Nhập trọng lượng phần cây còn lại"
                    : true,
              }}
              disabled={busy}
              fullWidth
            />
            {restValue > 0 ? (
              <Stack spacing={1}>
                <FormSelect<Values>
                  name="restMaterialId"
                  label="NVL nhận phần cây còn lại"
                  size="small"
                  options={restOptions}
                  displayEmpty
                  disabled={busy}
                  fullWidth
                />
                <FormImageField<Values>
                  name="restImages"
                  label="Ảnh phần cây còn lại"
                  kind="CASTING_TREE"
                  required
                  requiredMessage="Chụp ảnh cân phần cây còn lại"
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
            {rootError ? (
              <Typography color="error" variant="body2">
                {rootError}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !slip}>
            {saving ? "Đang lưu…" : "Cắt cây thông và chuyển Nguội"}
          </Button>
        </DialogActions>
      </DialogForm>
    </Dialog>
  );
}
