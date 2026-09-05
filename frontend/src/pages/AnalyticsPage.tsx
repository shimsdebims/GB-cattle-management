import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import { analyticsAPI } from '../services/api';
import { ChartData } from '../types';

const AnalyticsPage: React.FC = () => {
  const [milkChart, setMilkChart] = useState<ChartData | null>(null);
  const [cattleChart, setCattleChart] = useState<ChartData | null>(null);
  const [financialChart, setFinancialChart] = useState<ChartData | null>(null);
  const [feedingChart, setFeedingChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  const fetchCharts = React.useCallback(async () => {
    setLoading(true);
    try {
      // Fetch milk production chart
      const milkResponse = await analyticsAPI.getMilkProductionChart({ days });
      setMilkChart(milkResponse.data);

      // Fetch cattle comparison chart
      const cattleResponse = await analyticsAPI.getCattleComparison({ days });
      setCattleChart(cattleResponse.data);

      // Fetch financial overview
      const financialResponse = await analyticsAPI.getFinancialOverview({ days });
      setFinancialChart(financialResponse.data);

      // Fetch feeding cost analysis
      const feedingResponse = await analyticsAPI.getFeedingCostAnalysis({ days });
      setFeedingChart(feedingResponse.data);
    } catch (error) {
      console.error('Error fetching charts:', error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Time Period</InputLabel>
          <Select
            value={days}
            label="Time Period"
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <MenuItem value={7}>Last 7 days</MenuItem>
            <MenuItem value={30}>Last 30 days</MenuItem>
            <MenuItem value={90}>Last 90 days</MenuItem>
            <MenuItem value={365}>Last year</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={fetchCharts}>
          Refresh Charts
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Milk Production Chart */}
          {milkChart && (
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Milk Production Trend
                </Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={`data:image/png;base64,${milkChart.chart}`}
                    alt="Milk Production Chart"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Cattle Comparison Chart */}
          {cattleChart && (
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Cattle Production Comparison
                </Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={`data:image/png;base64,${cattleChart.chart}`}
                    alt="Cattle Comparison Chart"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Financial Overview Chart */}
          {financialChart && (
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Financial Overview
                </Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={`data:image/png;base64,${financialChart.chart}`}
                    alt="Financial Overview Chart"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Feeding Cost Analysis Chart */}
          {feedingChart && (
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Feeding Cost Analysis
                </Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={`data:image/png;base64,${feedingChart.chart}`}
                    alt="Feeding Cost Analysis Chart"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default AnalyticsPage;
