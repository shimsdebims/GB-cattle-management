import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  CircularProgress,
} from '@mui/material';
import { Pets, LocalDrink, TrendingUp } from '@mui/icons-material';
import { cattleAPI, milkAPI, financialAPI } from '../services/api';
import { Cattle, MilkSummary, FinancialSummary } from '../types';

interface StatsCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const Dashboard: React.FC = () => {
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [milkSummary, setMilkSummary] = useState<MilkSummary[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch cattle data
        const cattleResponse = await cattleAPI.getAll();
        setCattle(cattleResponse.data);

        // Fetch milk summary for last 30 days
        const milkResponse = await milkAPI.getSummary({ days: 30 });
        setMilkSummary(milkResponse.data);

        // Fetch financial summary for last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const financialResponse = await financialAPI.getSummary({
          start_date: thirtyDaysAgo.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0],
        });
        setFinancialSummary(financialResponse.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const totalCattle = cattle.length;
  const activeCattle = cattle.filter(c => c.current_status === 'Active').length;
  const totalMilkProduction = milkSummary.reduce((sum, cow) => sum + cow.total_liters, 0);
  const averageDailyProduction = milkSummary.reduce((sum, cow) => sum + cow.average_daily_liters, 0);

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
                  <strong>Total Revenue:</strong> ${financialSummary.total_revenue.toFixed(2)}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  <strong>Total Expenses:</strong> ${financialSummary.total_expenses.toFixed(2)}
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mt: 2, 
                    color: financialSummary.net_income >= 0 ? 'green' : 'red' 
                  }}
                >
                  <strong>Net Income:</strong> ${financialSummary.net_income.toFixed(2)}
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
                {milkSummary
                  .sort((a, b) => b.total_liters - a.total_liters)
                  .slice(0, 5)
                  .map((cow, index) => (
                    <Box key={cow.cattle_id} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        <strong>{index + 1}. {cow.cattle_name} ({cow.tag_number}):</strong> {cow.total_liters.toFixed(1)} L
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
