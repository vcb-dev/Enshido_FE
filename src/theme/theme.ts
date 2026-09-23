import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1b4f72',
      dark: '#154360',
      light: '#2980b9',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#34495e',
      contrastText: '#ffffff',
    },
    background: {
      default: '#eef1f4',
      paper: '#ffffff',
    },
    text: {
      primary: '#1c2833',
      secondary: '#5d6d7e',
    },
    divider: '#d5dbe0',
    success: { main: '#1e8449' },
    error: { main: '#c0392b' },
    warning: { main: '#b9770e' },
  },
  typography: {
    fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1.05rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { height: '100%', overflow: 'hidden' },
        body: { height: '100%', overflow: 'hidden', backgroundColor: '#eef1f4' },
        // dvh thay vì 100%: trên iOS Safari chiều cao 100% tính theo viewport lớn
        // nên ~60px cuối bị cắt mà không cuộn tới được. Trang đã khoá cuộn nên
        // thanh URL không bao giờ thu lại → dvh ổn định, không giật layout.
        // Cài PWA lên iPhone có tai thỏ: viewport-fit=cover cho nội dung chạm mép,
        // padding safe-area trả lại phần bị tai thỏ / thanh home che. Chỉ đẩy được phần
        // nằm trong luồng trang — thứ gì position: fixed (AppBar, drawer, dialog toàn
        // màn hình, toast) phải tự bù ở override riêng bên dưới.
        '#root': {
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          boxSizing: 'border-box',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, size: 'small' },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid #d5dbe0',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          borderBottom: '1px solid #d5dbe0',
          backgroundImage: 'none',
        },
        // Fixed nên không ăn padding của #root: tự lùi xuống dưới thanh trạng thái. Chiều
        // cao tăng đúng bằng phần #root đã đẩy nội dung xuống, nên Toolbar đệm trong
        // AppShell vẫn khớp mép dưới header.
        positionFixed: {
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#f4f6f7',
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.8rem',
            color: '#34495e',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 4 },
        // Dialog toàn màn hình trên điện thoại: tiêu đề và nút cuối không bị che.
        paperFullScreen: {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          borderRight: '1px solid #d5dbe0',
          // MUI v9 không áp override anchorLeft/… (chỉ gắn class) — chia theo anchor ở đây.
          variants: [
            // Drawer trái/phải cao hết màn: né cả tai thỏ lẫn thanh home.
            {
              props: { anchor: 'left' },
              style: {
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
              },
            },
            {
              props: { anchor: 'right' },
              style: {
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingRight: 'env(safe-area-inset-right)',
              },
            },
            // Bộ lọc trượt từ dưới lên (PanelToolbar): chỉ chạm thanh home.
            { props: { anchor: 'bottom' }, style: { paddingBottom: 'env(safe-area-inset-bottom)' } },
          ],
        },
      },
    },
  },
})
