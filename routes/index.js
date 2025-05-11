const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const regimenRoutes = require('./regimenRoutes');
const workoutLogRoutes = require('./workoutLogRoutes');
const notificationRoutes = require('./notificationRoutes');
const achievementRoutes = require('./achievementRoutes');
const healthRoutes = require('./healthRoutes');

const router = express.Router();

// Mount each individual router onto the main API router
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/regimens', regimenRoutes);
router.use('/workout-logs', workoutLogRoutes);
router.use('/notifications', notificationRoutes);
router.use('/achievements', achievementRoutes);
router.use('/health', healthRoutes);

// Optional: Add a health check or version endpoint for the API root (/api)
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is healthy and running',
    version: '1.0.0' // Example version
  });
});

module.exports = router; 