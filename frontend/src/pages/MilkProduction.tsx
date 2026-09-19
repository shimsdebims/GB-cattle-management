import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Grid,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { milkAPI, cattleAPI } from '../services/api';
import { MilkProduction as MilkProductionType, Cattle } from '../types';

interface MilkFormData {
  cattle_id: number;
  date_recorded: string;
  quantity_liters: number;
  quality_score?: number;
  notes?: string;
}

const MilkProduction: React.FC = () => {
  const [milkRecords, setMilkRecords] = useState<MilkProductionType[]>([]);
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MilkProductionType | null>(null);
  const [formData, setFormData] = useState<MilkFormData>({
    cattle_id: 0,
    date_recorded: new Date().toISOString().split('T')[0],
    quantity_liters: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [milkResponse, cattleResponse] = await Promise.all([
        milkAPI.getAll(),
        cattleAPI.getAll(),
      ]);
      setMilkRecords(milkResponse.data);
      setCattle(cattleResponse.data.filter(c => c.current_status === 'Active'));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (record?: MilkProductionType) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        cattle_id: record.cattle_id,
        date_recorded: record.date_recorded,
        quantity_liters: record.quantity_liters,
        quality_score: record.quality_score,
        notes: record.notes || '',
      });
    } else {
      setEditingRecord(null);
      setFormData({
        cattle_id: cattle[0]?.id || 0,
        date_recorded: new Date().toISOString().split('T')[0],
        quantity_liters: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRecord(null);
  };

  const handleInputChange = (field: keyof MilkFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (editingRecord) {
        await milkAPI.update(editingRecord.id, formData);
      } else {
        await milkAPI.create(formData);
      }
      await fetchData();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving milk record:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this milk record?')) {
      try {
        await milkAPI.delete(id);
        await fetchData();
      } catch (error) {
        console.error('Error deleting milk record:', error);
      }
    }
  };

  const getCattleName = (cattleId: number) => {
    const cow = cattle.find(c => c.id === cattleId);
    return cow ? `${cow.name} (${cow.tag_number})` : 'Unknown';
  };

  const getQualityColor = (score?: number) => {
    if (!score) return 'default';
    if (score >= 4.5) return 'success';
    if (score >= 3.5) return 'info';
    if (score >= 2.5) return 'warning';
    return 'error';
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
          Milk Production Records
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2 }}
        >
          Add Milk Record
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ backgroundColor: '#00374A', border: '1px solid #394F56' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#FFFFFF', fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ color: '#FFFFFF', fontWeight: 600 }}>Cattle</TableCell>
              <TableCell sx={{ color: '#FFFFFF', fontWeight: 600 }}>Quantity (L)</TableCell>
              <TableCell sx={{ color: '#FFFFFF', fontWeight: 600 }}>Quality Score</TableCell>
              <TableCell sx={{ color: '#FFFFFF', fontWeight: 600 }}>Notes</TableCell>
              <TableCell sx={{ color: '#FFFFFF', fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {milkRecords.map((record) => (
              <TableRow key={record.id} sx={{ '&:hover': { backgroundColor: '#001E2B' } }}>
                <TableCell sx={{ color: '#C1C7CD' }}>
                  {new Date(record.date_recorded).toLocaleDateString()}
                </TableCell>
                <TableCell sx={{ color: '#C1C7CD' }}>
                  {getCattleName(record.cattle_id)}
                </TableCell>
                <TableCell sx={{ color: '#00ED64', fontWeight: 500 }}>
                  {record.quantity_liters} L
                </TableCell>
                <TableCell>
                  {record.quality_score ? (
                    <Chip
                      label={record.quality_score}
                      color={getQualityColor(record.quality_score) as any}
                      size="small"
                    />
                  ) : (
                    <Typography variant="body2" color="textSecondary">-</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ color: '#C1C7CD', maxWidth: 200 }}>
                  {record.notes ? (
                    <Typography variant="body2" noWrap>
                      {record.notes}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="textSecondary">-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(record)}
                    sx={{ color: '#00ED64', mr: 1 }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(record.id)}
                    sx={{ color: '#FF6B6B' }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#00374A',
            border: '1px solid #394F56',
          }
        }}
      >
        <DialogTitle sx={{ color: '#FFFFFF' }}>
          {editingRecord ? 'Edit Milk Record' : 'Add Milk Record'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Cattle"
                value={formData.cattle_id}
                onChange={(e) => handleInputChange('cattle_id', parseInt(e.target.value))}
                required
              >
                {cattle.map((cow) => (
                  <MenuItem key={cow.id} value={cow.id}>
                    {cow.name} ({cow.tag_number}) - {cow.breed}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Date Recorded"
                value={formData.date_recorded}
                onChange={(e) => handleInputChange('date_recorded', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Quantity (Liters)"
                value={formData.quantity_liters}
                onChange={(e) => handleInputChange('quantity_liters', parseFloat(e.target.value))}
                inputProps={{ step: 0.1, min: 0 }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Quality Score (1-5)"
                value={formData.quality_score || ''}
                onChange={(e) => handleInputChange('quality_score', parseFloat(e.target.value))}
                inputProps={{ step: 0.1, min: 1, max: 5 }}
                helperText="Rate milk quality from 1 (poor) to 5 (excellent)"
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
                placeholder="Any additional notes about this milk production..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} sx={{ color: '#C1C7CD' }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingRecord ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MilkProduction;
