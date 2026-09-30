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
  Snackbar,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { milkAPI, cattleAPI, describeApiError } from '../services/api';
import { MilkProduction as MilkProductionType, Cattle, cattleIdOf } from '../types';

interface MilkFormData {
  cattle_id: string;
  date_recorded: string;
  quantity_liters: number;
  quality_score?: number;
  notes?: string;
}

/** Today's local calendar date as YYYY-MM-DD (toISOString would shift to UTC). */
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Records are stored at UTC midnight; show that calendar day, not the local shift. */
const formatDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
};

const MilkProduction: React.FC = () => {
  const [milkRecords, setMilkRecords] = useState<MilkProductionType[]>([]);
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MilkProductionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<MilkFormData>({
    cattle_id: '',
    date_recorded: todayLocal(),
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
      setMilkRecords(Array.isArray(milkResponse.data) ? milkResponse.data : []);
      setCattle(
        (Array.isArray(cattleResponse.data) ? cattleResponse.data : []).filter(
          (c) => c.current_status === 'Active' && c.gender === 'Female'
        )
      );
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(describeApiError(err, 'Unable to load milk records right now.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (record?: MilkProductionType) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        cattle_id: cattleIdOf(record.cattle_id),
        date_recorded: record.date_recorded.slice(0, 10),
        quantity_liters: record.quantity_liters,
        quality_score: record.quality_score,
        notes: record.notes || '',
      });
    } else {
      setEditingRecord(null);
      setFormData({
        cattle_id: cattle[0]?._id || '',
        date_recorded: todayLocal(),
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
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        cattle_id: formData.cattle_id,
        date_recorded: formData.date_recorded,
        quantity_liters: formData.quantity_liters,
      };
      if (formData.quality_score && !Number.isNaN(formData.quality_score)) {
        payload.quality_score = formData.quality_score;
      }
      if (formData.notes?.trim()) payload.notes = formData.notes.trim();

      if (editingRecord) {
        await milkAPI.update(editingRecord._id, payload);
      } else {
        await milkAPI.create(payload);
      }
      handleCloseDialog();
      await fetchData();
    } catch (err) {
      console.error('Error saving milk record:', err);
      setError(describeApiError(err, 'The milk record could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this milk record?')) {
      try {
        await milkAPI.delete(id);
        await fetchData();
      } catch (err) {
        console.error('Error deleting milk record:', err);
        setError(describeApiError(err, 'The milk record could not be deleted.'));
      }
    }
  };

  const getCattleName = (ref: MilkProductionType['cattle_id']) => {
    if (ref && typeof ref !== 'string') return `${ref.name} (${ref.tag_number})`;
    const cow = cattle.find((c) => c._id === ref);
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
              <TableRow key={record._id} sx={{ '&:hover': { backgroundColor: '#001E2B' } }}>
                <TableCell sx={{ color: '#C1C7CD' }}>
                  {formatDay(record.date_recorded)}
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
                    onClick={() => handleDelete(record._id)}
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
                onChange={(e) => handleInputChange('cattle_id', e.target.value)}
                required
              >
                {cattle.map((cow) => (
                  <MenuItem key={cow._id} value={cow._id}>
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
          <Button onClick={handleSubmit} variant="contained" disabled={saving || !formData.cattle_id}>
            {saving ? <CircularProgress size={20} color="inherit" /> : editingRecord ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MilkProduction;
