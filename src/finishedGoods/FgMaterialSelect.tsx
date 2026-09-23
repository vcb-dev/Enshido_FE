import { useEffect, useId, useRef, useState } from 'react'
import { InputAdornment, Menu, MenuItem, TextField } from '@mui/material'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useController } from 'react-hook-form'
import { READ_ONLY_FIELD_SX } from '../components/ui'

const FG_MATERIAL_GROUPS = [
  { label: 'Bạc', children: ['Bạc S925', 'Bạc S999'] },
  { label: 'Vàng', children: ['Vàng 18K', 'Vàng 24K'] },
  { label: 'Đồng' },
] as const

const FG_MATERIAL_LEAVES = FG_MATERIAL_GROUPS.flatMap((group) =>
  group.children ? [...group.children] : [group.label],
)

export function isSilverFgMaterial(value: string | null | undefined) {
  return (value ?? '').startsWith('Bạc')
}

const ITEM_SX = {
  fontSize: '0.875rem',
  lineHeight: 1.4375,
  minHeight: 36,
  fontWeight: 400,
} as const

function groupOf(value: string) {
  return (
    FG_MATERIAL_GROUPS.find(
      (group) =>
        group.label === value || (group.children && (group.children as readonly string[]).includes(value)),
    )?.label ?? null
  )
}

/** Chất liệu kho thành phẩm: Bạc / Vàng xổ loại, Đồng chọn luôn. */
export function FormFgMaterialSelect({
  name,
  readOnly,
}: {
  name: 'mainMaterial'
  readOnly?: boolean
}) {
  const { field, fieldState } = useController({ name })
  const value = field.value ?? ''
  const errorText = fieldState.error?.message
  const buttonId = useId()
  const menuId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setExpanded(groupOf(value))
  }, [open, value])

  if (readOnly) {
    return (
      <TextField
        label="Chất liệu"
        disabled
        value={value || '—'}
        sx={READ_ONLY_FIELD_SX}
      />
    )
  }

  function pick(next: string) {
    field.onChange(next)
    setOpen(false)
  }

  return (
    <>
      <TextField
        ref={anchorRef}
        label="Chất liệu"
        value={value || 'Chọn chất liệu…'}
        error={Boolean(errorText)}
        helperText={errorText}
        onClick={() => setOpen(true)}
        onBlur={field.onBlur}
        inputRef={field.ref}
        slotProps={{
          input: {
            readOnly: true,
            notched: true,
            endAdornment: (
              <InputAdornment position="end" sx={{ pointerEvents: 'none' }}>
                <ArrowDropDown />
              </InputAdornment>
            ),
          },
          inputLabel: { shrink: true },
          htmlInput: {
            id: buttonId,
            role: 'combobox',
            'aria-expanded': open,
            'aria-controls': menuId,
            'aria-haspopup': 'listbox',
            style: { cursor: 'pointer' },
          },
        }}
        sx={{
          '& .MuiInputBase-input': {
            color: value ? undefined : '#5d6d7e',
          },
        }}
      />
      <Menu
        id={menuId}
        anchorEl={anchorRef.current}
        open={open}
        onClose={(_event, reason) => {
          if (reason === 'itemClick') return
          setOpen(false)
        }}
        MenuListProps={{ 'aria-labelledby': buttonId, dense: true, sx: { py: 0.5, minWidth: 220 } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {FG_MATERIAL_GROUPS.map((group) => {
          const children = 'children' in group ? group.children : undefined
          if (!children) {
            return (
              <MenuItem key={group.label} selected={value === group.label} onClick={() => pick(group.label)} sx={ITEM_SX}>
                {group.label}
              </MenuItem>
            )
          }
          const isOpen = expanded === group.label
          return [
            <MenuItem
              key={group.label}
              onClick={() => setExpanded(isOpen ? null : group.label)}
              sx={{ ...ITEM_SX, justifyContent: 'space-between' }}
            >
              {group.label}
              {isOpen ? (
                <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} />
              ) : (
                <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />
              )}
            </MenuItem>,
            ...(isOpen
              ? children.map((child) => (
                  <MenuItem
                    key={child}
                    selected={value === child}
                    onClick={() => pick(child)}
                    sx={{ ...ITEM_SX, pl: 3 }}
                  >
                    {child}
                  </MenuItem>
                ))
              : []),
          ]
        })}
        {value && !(FG_MATERIAL_LEAVES as readonly string[]).includes(value) ? (
          <MenuItem selected onClick={() => pick(value)} sx={{ ...ITEM_SX, color: 'text.secondary' }}>
            {value}
          </MenuItem>
        ) : null}
      </Menu>
    </>
  )
}
