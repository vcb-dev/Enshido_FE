import { useMemo, useState } from 'react'
import {
  Box,
  Collapse,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popover,
  TextField,
} from '@mui/material'
import type { LookupItem, MetalKindCode } from '../api/inventory'
import { CATEGORY_GROUPS } from './catalog'

export type CategorySelectProps = {
  label?: string
  valueId: string
  options: LookupItem[]
  groups?: Array<{ code: string; name: string }>
  required?: boolean
  disabled?: boolean
  errorText?: string
  helperText?: string
  sx?: object
  onBlur?: () => void
  onChange: (typeId: string, metalKind: MetalKindCode | 'OTHER' | string | '') => void
}

/** Chọn danh mục NVL: bấm nhóm (Bạc, Đá, Phân loại khác, …) để xổ danh mục con. */
export function CategorySelect({
  label = 'Danh mục NVL',
  valueId,
  options,
  groups = CATEGORY_GROUPS,
  required,
  disabled,
  errorText,
  helperText,
  sx,
  onBlur,
  onChange,
}: CategorySelectProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const selected = options.find((item) => item.id === valueId)
  const groupCode = selected?.group ?? selected?.metalKind ?? ''
  const parentName = groups.find((item) => item.code === groupCode)?.name
  const display = selected
    ? parentName && parentName !== selected.name
      ? `${parentName} · ${selected.name}`
      : selected.name
    : ''

  const q = query.trim().toLowerCase()
  const groupsWithChildren = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          children: options.filter((item) => (item.group ?? item.metalKind) === group.code),
        }))
        .filter((group) => group.children.length > 0),
    [groups, options],
  )

  const visible = useMemo(
    () =>
      groupsWithChildren
        .map((group) => ({
          ...group,
          children: q
            ? group.children.filter(
                (item) =>
                  item.name.toLowerCase().includes(q) ||
                  group.name.toLowerCase().includes(q),
              )
            : group.children,
        }))
        .filter((group) => group.children.length > 0),
    [groupsWithChildren, q],
  )

  function toggle(code: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function pick(item: LookupItem) {
    onChange(item.id, item.group ?? item.metalKind ?? '')
    setAnchor(null)
    setQuery('')
    onBlur?.()
  }

  return (
    <Box sx={{ width: '100%', minWidth: 0, ...((sx ?? {}) as object) }}>
      <TextField
        label={label}
        value={display}
        required={required}
        disabled={disabled}
        fullWidth
        size="small"
        error={Boolean(errorText)}
        helperText={errorText ?? helperText}
        placeholder="Chọn danh mục…"
        onClick={(e) => {
          if (disabled) return
          setAnchor(e.currentTarget)
          if (groupCode) setOpenGroups(new Set([groupCode]))
        }}
        slotProps={{
          input: {
            readOnly: true,
            sx: { cursor: disabled ? 'default' : 'pointer' },
            endAdornment: (
              <InputAdornment position="end">
                <Box sx={{ fontSize: 12, color: 'text.secondary', pr: 0.5 }}>
                  {anchor ? '▲' : '▼'}
                </Box>
              </InputAdornment>
            ),
          },
        }}
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null)
          setQuery('')
          onBlur?.()
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: anchor?.offsetWidth ?? 280, mt: 0.5 } } }}
      >
        <Paper elevation={0}>
          <Box sx={{ p: 1, pb: 0.5 }}>
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm danh mục…"
              size="small"
              fullWidth
              autoFocus
            />
          </Box>
          <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto', py: 0.5 }}>
            {visible.map((group) => {
              const expanded = q.length > 0 || openGroups.has(group.code)
              return (
                <Box key={group.code}>
                  <ListItemButton onClick={() => toggle(group.code)} sx={{ py: 0.75 }}>
                    <ListItemText
                      primary={group.name}
                      primaryTypographyProps={{ fontWeight: 700, fontSize: 13 }}
                    />
                    <Box sx={{ fontSize: 11, color: 'text.secondary' }}>{expanded ? '▲' : '▼'}</Box>
                  </ListItemButton>
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    {group.children.length ? (
                      group.children.map((item) => (
                        <ListItemButton
                          key={item.id}
                          selected={item.id === valueId}
                          onClick={() => pick(item)}
                          sx={{ pl: 4, py: 0.5 }}
                        >
                          <ListItemText
                            primary={item.name}
                            primaryTypographyProps={{ fontSize: 13 }}
                          />
                        </ListItemButton>
                      ))
                    ) : (
                      <ListItemText
                        sx={{ pl: 4, py: 0.75 }}
                        primary="Chưa có danh mục con"
                        primaryTypographyProps={{ color: 'text.secondary', fontSize: 13 }}
                      />
                    )}
                  </Collapse>
                </Box>
              )
            })}
            {visible.length === 0 ? (
              <ListItemText
                sx={{ px: 2, py: 1.5 }}
                primary="Không có danh mục khớp"
                primaryTypographyProps={{ color: 'text.secondary', fontSize: 13 }}
              />
            ) : null}
          </List>
        </Paper>
      </Popover>
    </Box>
  )
}
