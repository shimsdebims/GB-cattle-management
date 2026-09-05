import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Chip,
  CardActions,
} from '@mui/material';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import { cattleAPI } from '../services/api';
import { Cattle } from '../types';

interface CattleFormData {
  tag_number: string;
  name: string;
  breed: string;
  date_of_birth: string;
  gender: string;
  weight?: number;
  health_status: string;
  location?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_status: string;
  notes?: string;
}

const CattleManagement: React.FC = () => {
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCattle, setEditingCattle] = useState<Cattle | null>(null);
  const [formData, setFormData] = useState<CattleFormData>({
    tag_number: '',
    name: '',
    breed: '',
    date_of_birth: '',
    gender: 'Female',
    health_status: 'Healthy',
    current_status: 'Active',
  });

  const breeds = ['Holstein', 'Jersey', 'Angus', 'Hereford', 'Brahman', 'Simmental', 'Charolais', 'Other'];
  const healthStatuses = ['Healthy', 'Sick', 'Injured', 'Pregnant', 'Recovering'];
  const statuses = ['Active', 'Sold', 'Deceased', 'Quarantined'];

  useEffect(() => {
    fetchCattle();
  }, []);

  const fetchCattle = async () => {
    try {
      setLoading(true);
      const response = await cattleAPI.getAll();
      setCattle(response.data);
    } catch (error) {
      console.error('Error fetching cattle:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (cattle?: Cattle) => {
    if (cattle) {
      setEditingCattle(cattle);
      setFormData({
        tag_number: cattle.tag_number,
        name: cattle.name,
        breed: cattle.breed,
        date_of_birth: cattle.date_of_birth.split('T')[0],
        gender: cattle.gender,
        weight: cattle.weight,
        health_status: cattle.health_status,
        location: cattle.location || '',
        purchase_date: cattle.purchase_date ? cattle.purchase_date.split('T')[0] : '',
        purchase_price: cattle.purchase_price,
        current_status: cattle.current_status,
        notes: cattle.notes || '',
      });
    } else {
      setEditingCattle(null);
      setFormData({
        tag_number: '',
        name: '',
        breed: '',
        date_of_birth: '',
        gender: 'Female',
        health_status: 'Healthy',
        current_status: 'Active',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCattle(null);
  };

  const handleInputChange = (field: keyof CattleFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (editingCattle) {
        await cattleAPI.update(editingCattle.id, formData);
      } else {
        await cattleAPI.create(formData);
      }
      await fetchCattle();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving cattle:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this cattle record?')) {
      try {
        await cattleAPI.delete(id);
        await fetchCattle();
      } catch (error) {
        console.error('Error deleting cattle:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Sold': return 'info';
      case 'Deceased': return 'error';
      case 'Quarantined': return 'warning';
      default: return 'default';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'Healthy': return 'success';
      case 'Sick': return 'error';
      case 'Injured': return 'warning';
      case 'Pregnant': return 'info';
      case 'Recovering': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Cattle Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2 }}
        >
          Add New Cattle
        </Button>
      </Box>

      <Grid container spacing={3}>
        {cattle.map((cow) => (
          <Grid item xs={12} sm={6} md={4} key={cow.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" sx={{ color: '#00ED64' }}>
                    {cow.name}
                  </Typography>
                  <Chip
                    label={cow.current_status}
                    color={getStatusColor(cow.current_status) as any}
                    size="small"
                  />
                </Box>
                
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Tag:</strong> {cow.tag_number}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Breed:</strong> {cow.breed}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  <strong>Gender:</strong> {cow.gender}
                </Typography>
                {cow.weight && (
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    <strong>Weight:</strong> {cow.weight} kg
                  </Typography>
                )}
                <Box mt={1}>
                  <Chip
                    label={cow.health_status}
                    color={getHealthColor(cow.health_status) as any}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
              
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Box>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(cow)}
                    sx={{ color: '#00ED64' }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(cow.id)}
                    sx={{ color: '#FF6B6B' }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  sx={{ color: '#C1C7CD' }}
                >
                  Details
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#00374A',
            border: '1px solid #394F56',
          }
        }}
      >
        <DialogTitle sx={{ color: '#FFFFFF' }}>
          {editingCattle ? 'Edit Cattle' : 'Add New Cattle'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tag Number"
                value={formData.tag_number}
                onChange={(e) => handleInputChange('tag_number', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Breed"
                value={formData.breed}
                onChange={(e) => handleInputChange('breed', e.target.value)}
                required
              >
                {breeds.map((breed) => (
                  <MenuItem key={breed} value={breed}>
                    {breed}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Gender"
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                required
              >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Date of Birth"
                value={formData.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Weight (kg)"
                value={formData.weight || ''}
                onChange={(e) => handleInputChange('weight', parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Health Status"
                value={formData.health_status}
                onChange={(e) => handleInputChange('health_status', e.target.value)}
              >
                {healthStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Current Status"
                value={formData.current_status}
                onChange={(e) => handleInputChange('current_status', e.target.value)}
              >
                {statuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                value={formData.location || ''}
                onChange={(e) => handleInputChange('location', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Purchase Date"
                value={formData.purchase_date || ''}
                onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Purchase Price"
                value={formData.purchase_price || ''}
                onChange={(e) => handleInputChange('purchase_price', parseFloat(e.target.value))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} sx={{ color: '#C1C7CD' }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCattle ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CattleManagement;

