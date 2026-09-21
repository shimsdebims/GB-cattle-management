import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Divider } from '@mui/material';
import { Menu as MenuIcon, Close as CloseIcon, Pets, LocalDrink, Restaurant, Analytics, AttachMoney } from '@mui/icons-material';
import useMediaQuery from '@mui/material/useMediaQuery';
import Dashboard from './pages/Dashboard';
import CattleManagement from './pages/CattleManagement';
import MilkProduction from './pages/MilkProduction';
import FeedingManagement from './pages/FeedingManagement';
import FinancialManagement from './pages/FinancialManagement';
import AnalyticsPage from './pages/AnalyticsPage';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ED64', // MongoDB green
    },
    secondary: {
      main: '#FFE212', // MongoDB yellow
    },
    background: {
      default: '#001E2B', // MongoDB dark blue
      paper: '#00374A', // Lighter MongoDB blue
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#C1C7CD',
    },
    divider: '#394F56',
  },
  typography: {
    fontFamily: '"Helvetica Neue", "Segoe UI", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      color: '#FFFFFF',
    },
    h6: {
      fontWeight: 500,
      color: '#FFFFFF',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#001E2B',
          borderBottom: '1px solid #394F56',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#00374A',
          borderRight: '1px solid #394F56',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#00374A',
          border: '1px solid #394F56',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
        contained: {
          backgroundColor: '#00ED64',
          color: '#001E2B',
          '&:hover': {
            backgroundColor: '#00C956',
          },
        },
      },
    },
  },
});

const drawerWidth = 220;

const menuItems = [
  { text: 'Dashboard', icon: <Analytics />, path: '/' },
  { text: 'Cattle Management', icon: <Pets />, path: '/cattle' },
  { text: 'Milk Production', icon: <LocalDrink />, path: '/milk' },
  { text: 'Feeding', icon: <Restaurant />, path: '/feeding' },
  { text: 'Financial', icon: <AttachMoney />, path: '/financial' },
  { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
];

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const drawerContent = (
    <Box sx={{ width: drawerWidth, maxWidth: '80vw' }}>
      <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
      <Divider />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton component={Link} to={item.path} onClick={() => setMobileOpen(false)}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex' }}>
          <AppBar
            position="fixed"
            sx={{
              zIndex: (theme) => theme.zIndex.drawer + 1,
              width: isMobile ? '100%' : `calc(100% - ${drawerWidth}px)`,
              ml: isMobile ? 0 : `${drawerWidth}px`,
            }}
          >
            <Toolbar sx={{ minHeight: { xs: 62, md: 72 } }}>
              {isMobile && (
                <IconButton
                  color="inherit"
                  aria-label="open navigation"
                  edge="start"
                  onClick={() => setMobileOpen((prev) => !prev)}
                  sx={{ mr: 2 }}
                >
                  {mobileOpen ? <CloseIcon /> : <MenuIcon />}
                </IconButton>
              )}
              <Typography variant="h6" noWrap component="div" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>
                Dairy Cattle Management System
              </Typography>
            </Toolbar>
          </AppBar>

          {isMobile ? (
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={() => setMobileOpen(false)}
              ModalProps={{ keepMounted: true }}
              sx={{
                '& .MuiDrawer-paper': {
                  boxSizing: 'border-box',
                  width: drawerWidth,
                },
              }}
            >
              {drawerContent}
            </Drawer>
          ) : (
            <Drawer
              variant="permanent"
              open
              sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                  width: drawerWidth,
                  boxSizing: 'border-box',
                },
              }}
            >
              {drawerContent}
            </Drawer>
          )}

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: { xs: 2, md: 3 },
              width: '100%',
              minHeight: '100vh',
              mt: { xs: 7, md: 0 },
              ml: isMobile ? 0 : `${drawerWidth}px`,
            }}
          >
            <Toolbar sx={{ display: { xs: 'none', md: 'block' } }} />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cattle" element={<CattleManagement />} />
              <Route path="/milk" element={<MilkProduction />} />
              <Route path="/feeding" element={<FeedingManagement />} />
              <Route path="/financial" element={<FinancialManagement />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
