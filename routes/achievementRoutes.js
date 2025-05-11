const express = require('express');
const achievementController = require('../controllers/achievementController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all achievement routes - user must be logged in
router.use(authController.protect);

// Route for the logged-in user to get their earned achievements
router.get('/my-achievements', achievementController.getMyAchievements);

// Potential future routes:
// router.get('/', authController.restrictTo('admin'), achievementController.getAllAchievementsDefinitions); // Admin view
// router.get('/user/:userId', authController.restrictTo('coach', 'admin'), achievementController.getUserAchievements); // Coach/Admin view

module.exports = router; 