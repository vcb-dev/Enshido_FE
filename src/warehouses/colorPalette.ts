import {
  amber,
  blue,
  blueGrey,
  brown,
  cyan,
  deepOrange,
  deepPurple,
  green,
  grey,
  indigo,
  lightBlue,
  lightGreen,
  lime,
  orange,
  pink,
  purple,
  red,
  teal,
  yellow,
} from '@mui/material/colors'

export type PaletteColor = {
  code: string
  name: string
  hex: string
}

/** Bảng màu đá / NVL lấy từ @mui/material/colors, có lọc trên dropdown. */
export const COLOR_CATALOG: PaletteColor[] = [
  { code: 'trang', name: 'Trắng', hex: grey[50] },
  { code: 'trang-nga', name: 'Trắng ngà', hex: grey[200] },
  { code: 'xam', name: 'Xám', hex: grey[500] },
  { code: 'den', name: 'Đen', hex: grey[900] },
  { code: 'vang', name: 'Vàng', hex: yellow[700] },
  { code: 'vang-nhat', name: 'Vàng nhạt', hex: yellow[400] },
  { code: 'champagne', name: 'Champagne', hex: amber[200] },
  { code: 'cam', name: 'Cam', hex: orange[700] },
  { code: 'cam-dam', name: 'Cam đậm', hex: deepOrange[700] },
  { code: 'nau', name: 'Nâu', hex: brown[600] },
  { code: 'do', name: 'Đỏ', hex: red[700] },
  { code: 'do-dam', name: 'Đỏ đậm', hex: red[900] },
  { code: 'hong', name: 'Hồng', hex: pink[400] },
  { code: 'hong-nhat', name: 'Hồng nhạt', hex: pink[200] },
  { code: 'hong-dam', name: 'Hồng đậm', hex: pink[700] },
  { code: 'tim', name: 'Tím', hex: purple[500] },
  { code: 'tim-dam', name: 'Tím đậm', hex: deepPurple[700] },
  { code: 'xanh-duong', name: 'Xanh dương', hex: blue[700] },
  { code: 'xanh-duong-nhat', name: 'Xanh dương nhạt', hex: lightBlue[300] },
  { code: 'xanh-duong-dam', name: 'Xanh dương đậm', hex: indigo[800] },
  { code: 'xanh-ngoc', name: 'Xanh ngọc', hex: cyan[500] },
  { code: 'xanh-la', name: 'Xanh lá', hex: green[600] },
  { code: 'xanh-la-nhat', name: 'Xanh lá nhạt', hex: lightGreen[400] },
  { code: 'teal', name: 'Xanh teal', hex: teal[500] },
  { code: 'lime', name: 'Xanh chanh', hex: lime[600] },
  { code: 'xanh-xam', name: 'Xanh xám', hex: blueGrey[400] },
]

export function colorHex(code?: string | null, name?: string | null) {
  const key = (code || '').toLowerCase()
  const label = (name || '').toLowerCase()
  const hit = COLOR_CATALOG.find(
    (c) => c.code === key || c.name.toLowerCase() === label,
  )
  return hit?.hex ?? grey[400]
}
