const WorkoutLog = require('../models/WorkoutLog.js');
const { parseISO, differenceInDays, startOfWeek, endOfWeek } = require('date-fns');

const ALL_ACHIEVEMENTS = [
  { id: 'first-workout', title: 'First Step', description: 'Completed your first workout!', iconName: 'Award' },
  { id: 'milestone-10', title: 'Workout Warrior (10)', description: 'Completed 10 workouts.', iconName: 'Star' },
  { id: 'milestone-25', title: 'Workout Pro (25)', description: 'Completed 25 workouts.', iconName: 'TrendingUp' },
  { id: 'consistent-week', title: 'Consistent Week', description: 'Completed workouts on 3+ days in a week.', iconName: 'Calendar' },
  // TODO: Add more achievement definitions here (e.g., PRs, program completion)
];

/**
 * Calculates which achievements a user has earned based on their workout logs.
 * @param {string} userId The ID of the user.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of earned achievement objects.
 */
const calculateUserAchievements = async (userId) => {
  const logs = await WorkoutLog.find({ userId }).select('completedAt').sort({ completedAt: 1 });

  if (!logs || logs.length === 0) {
    return [];
  }

  const earnedAchievements = [];
  const totalWorkouts = logs.length;
  const firstWorkoutDate = logs[0].completedAt;

  // Check for 'first-workout'
  if (totalWorkouts >= 1) {
    earnedAchievements.push({ ...ALL_ACHIEVEMENTS.find(a => a.id === 'first-workout'), achievedDate: firstWorkoutDate });
  }

  // Check for 'milestone-10'
  if (totalWorkouts >= 10) {
    // Use the date of the 10th workout
    earnedAchievements.push({ ...ALL_ACHIEVEMENTS.find(a => a.id === 'milestone-10'), achievedDate: logs[9].completedAt });
  }

  // Check for 'milestone-25'
  if (totalWorkouts >= 25) {
    // Use the date of the 25th workout
    earnedAchievements.push({ ...ALL_ACHIEVEMENTS.find(a => a.id === 'milestone-25'), achievedDate: logs[24].completedAt });
  }

  // Check for 'consistent-week'
  const workoutDates = logs.map(log => parseISO(String(log.completedAt)));
  let achievedConsistentWeek = false;
  let consistentWeekDate = null;

  for (let i = 0; i <= workoutDates.length - 3; i++) {
    // Check any 7-day window starting from each workout
    const windowStart = workoutDates[i];
    const windowEnd = new Date(windowStart.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days after
    
    const uniqueDaysInWindow = new Set();
    workoutDates.forEach(date => {
      if (date >= windowStart && date <= windowEnd) {
        uniqueDaysInWindow.add(date.toDateString()); // Add date string to count unique days
      }
    });

    if (uniqueDaysInWindow.size >= 3) {
      achievedConsistentWeek = true;
      // Mark achieved date as the end of the first successful 7-day window
      consistentWeekDate = windowEnd;
      break; // Found one consistent week, no need to check further
    }
  }

  if (achievedConsistentWeek) {
    earnedAchievements.push({ ...ALL_ACHIEVEMENTS.find(a => a.id === 'consistent-week'), achievedDate: consistentWeekDate });
  }

  // Return only the *earned* achievements, including their achieved date
  return earnedAchievements.map(ach => ({ ...ach, achieved: true }));
};

module.exports = {
  calculateUserAchievements,
  ALL_ACHIEVEMENTS // Export all definitions in case needed elsewhere
}; 