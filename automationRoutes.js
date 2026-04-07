const express = require('express');
const router = express.Router();
const { executeWorkflow, getAvailableCities, getAvailableFuelTypes, getVehicleTypes } = require('../services/routeIntelligence');

// Get metadata for form dropdowns
router.get('/automation/metadata', (req, res) => {
  res.json({
    success: true,
    cities: getAvailableCities(),
    fuelTypes: getAvailableFuelTypes(),
    vehicleTypes: getVehicleTypes(),
  });
});

// Execute full workflow pipeline
router.post('/automation/analyze', async (req, res) => {
  try {
    const result = await executeWorkflow(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
