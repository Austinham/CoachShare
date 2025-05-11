const achievementService = require('../services/achievementService');
const catchAsync = require('../utils/catchAsync');

/**
 * @desc    Get all achievements earned by the currently logged-in user
 * @route   GET /api/achievements/my-achievements
 * @access  Private (User must be logged in)
 */
const getMyAchievements = catchAsync(async (req, res, next) => {
  const userId = req.user._id; // Assuming user ID is attached by auth middleware
  
  const earnedAchievements = await achievementService.calculateUserAchievements(userId);
  
  res.status(200).json({
    status: 'success',
    results: earnedAchievements.length,
    data: {
      achievements: earnedAchievements,
    },
  });
});

module.exports = {
  getMyAchievements,
}; 