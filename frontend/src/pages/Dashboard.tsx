import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Pets, LocalDrink, TrendingUp } from '@mui/icons-material';
import { analyticsAPI, describeApiError } from '../services/api';
import { DashboardSummary, MilkTrends } from '../types';

interface StatsCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const formatFBu = (amount: number) => `${Math.round(amount).toLocaleString('en-US')} FBu`;

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<MilkTrends | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Totals are aggregated server-side, so they stay correct past one page of records.
        const [summaryResponse, trendsResponse] = await Promise.all([
          analyticsAPI.dashboard({ days: 30 }),
          analyticsAPI.milkTrends({ days: 30 }),
        ]);
        setSummary(summaryResponse.data);
        setTrends(trendsResponse.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(describeApiError(err, 'Could not load the dashboard.'));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const totalCattle = summary?.cattle.total_cattle ?? 0;
  const activeCattle = summary?.cattle.active_cattle ?? 0;
  const totalMilkProduction = summary?.milk_production.total_liters ?? 0;
  const averageDailyProduction = summary?.milk_production.average_daily_liters ?? 0;
  const financialSummary = summary?.financial;
  const topProducers = trends?.cattle_performance ?? [];

  const statsCards: StatsCard[] = [
    {
      title: 'Total Cattle',
      value: totalCattle.toString(),
      icon: <Pets fontSize="large" />,
      color: '#2E7D32',
    },
    {
      title: 'Active Cattle',
      value: activeCattle.toString(),
      icon: <Pets fontSize="large" />,
      color: '#388E3C',
    },
    {
      title: 'Milk Production (30 days)',
      value: `${totalMilkProduction.toFixed(1)} L`,
      icon: <LocalDrink fontSize="large" />,
      color: '#1976D2',
    },
    {
      title: 'Daily Average',
      value: `${averageDailyProduction.toFixed(1)} L`,
      icon: <TrendingUp fontSize="large" />,
      color: '#FF6F00',
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {card.title}
                    </Typography>
                    <Typography variant="h4" component="div">
                      {card.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: card.color }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Financial Summary */}
      {financialSummary && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Financial Summary (Last 30 Days)
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1">
                  <strong>Milk revenue:</strong> {formatFBu(financialSummary.milk_revenue)}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  <strong>Other revenue:</strong> {formatFBu(financialSummary.other_revenue)}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  <strong>Expenses:</strong> {formatFBu(financialSummary.total_expenses)}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    mt: 2,
                    color: financialSummary.net_profit >= 0 ? '#00ED64' : '#FF6B6B'
                  }}
                >
                  <strong>Net profit:</strong> {formatFBu(financialSummary.net_profit)}
                </Typography>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Top Milk Producers (Last 30 Days)
              </Typography>
              <Box sx={{ mt: 2 }}>
                {topProducers.length === 0 && (
                  <Typography variant="body2" color="textSecondary">
                    No milk recorded in the last 30 days.
                  </Typography>
                )}
                {topProducers.slice(0, 5).map((cow, index) => (
                  <Box key={cow.cattle_id} sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      <strong>{index + 1}. {cow.name} ({cow.tag_number}):</strong> {cow.total_quantity.toFixed(1)} L
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Recent Activity placeholder */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Typography variant="body2" color="textSecondary">
          • Add new milk production record<br />
          • Register new cattle<br />
          • Record feeding data<br />
          • View analytics reports
        </Typography>
      </Paper>
    </Box>
  );
};

export default Dashboard;
