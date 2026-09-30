import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsAPI, describeApiError } from '../services/api';
import { MilkTrends } from '../types';

/**
 * Charts are drawn in the browser from the API's aggregated data.
 * (The old Flask backend returned pre-rendered matplotlib images; the Express
 * API returns numbers instead.)
 */
const AnalyticsPage: React.FC = () => {
  const [days, setDays] = useState(30);
  const [trends, setTrends] = useState<MilkTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await analyticsAPI.milkTrends({ days });
      setTrends(response.data);
      setError(null);
    } catch (err) {
      setError(describeApiError(err, 'Could not load analytics.'));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const daily = (trends?.daily_trends ?? []).map((d) => ({
    date: d._id.slice(5),
    litres: Math.round(d.total_quantity * 10) / 10,
  }));
  const perCow = (trends?.cattle_performance ?? []).map((c) => ({
    name: c.tag_number,
    litres: Math.round(c.total_quantity * 10) / 10,
  }));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>

      <FormControl size="small" sx={{ minWidth: 160, mb: 3 }}>
        <InputLabel>Time Period</InputLabel>
        <Select value={days} label="Time Period" onChange={(e) => setDays(Number(e.target.value))}>
          <MenuItem value={7}>Last 7 days</MenuItem>
          <MenuItem value={30}>Last 30 days</MenuItem>
          <MenuItem value={90}>Last 90 days</MenuItem>
          <MenuItem value={365}>Last year</MenuItem>
        </Select>
      </FormControl>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      ) : daily.length === 0 ? (
        <Typography color="textSecondary">No milk recorded in this period yet.</Typography>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Daily milk (litres)
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#394F56" />
                  <XAxis dataKey="date" stroke="#C1C7CD" fontSize={12} />
                  <YAxis stroke="#C1C7CD" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="litres" stroke="#00ED64" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Litres per cow
              </Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={perCow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#394F56" />
                  <XAxis dataKey="name" stroke="#C1C7CD" fontSize={12} />
                  <YAxis stroke="#C1C7CD" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="litres" fill="#00ED64" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default AnalyticsPage;
