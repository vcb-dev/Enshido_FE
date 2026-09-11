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
        '#root': { height: '100dvh' },
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
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          borderRight: '1px solid #d5dbe0',
        },
      },
    },
  },
})
