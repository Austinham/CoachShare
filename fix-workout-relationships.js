/**
 * Workout Log Relationship Repair Script
 * 
 * This script directly fixes missing relationships between coaches, athletes, and regimens
 * for existing workout logs, resolving issues with workout logs not appearing in dashboards.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Check if we can read the database URL from the environment
console.log('Reading database configuration...');
const DB_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/coachshare';
console.log(`Using database URL: ${DB_URL.substring(0, 15)}...`);

// Models
const WorkoutLog = require('./models/WorkoutLog');
const User = require('./models/User');
const Regimen = require('./models/Regimen');

// Connect to database
mongoose.connect(DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to database'))
.catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

const fixWorkoutLogRelationships = async () => {
  try {
    console.log('🔧 Starting workout log relationship repair process...');
    
    // 1. Get all workout logs
    const workoutLogs = await WorkoutLog.find().lean();
    console.log(`📊 Found ${workoutLogs.length} workout logs in the database`);
    
    if (workoutLogs.length === 0) {
      console.log('No workout logs found to fix');
      return;
    }
    
    // Track repair statistics
    const stats = {
      processed: 0,
      skipped: 0,
      fixed: {
        coachToAthlete: 0,
        athleteToCoach: 0,
        regimenToAthlete: 0,
        anyFixes: 0
      }
    };

    // 2. Process each workout log
    for (const log of workoutLogs) {
      stats.processed++;
      console.log(`\n🔍 Processing log ${stats.processed}/${workoutLogs.length}: ${log._id}`);
      
      // Validate log
      if (!log.regimenId || !log.athleteId) {
        console.log(`  ⚠️ Log ${log._id} is missing required fields, skipping`);
        stats.skipped++;
        continue;
      }
      
      // Get the regimen
      const regimen = await Regimen.findById(log.regimenId);
      if (!regimen) {
        console.log(`  ⚠️ Referenced regimen ${log.regimenId} not found, skipping`);
        stats.skipped++;
        continue;
      }
      
      // Get the athlete
      const athlete = await User.findById(log.athleteId);
      if (!athlete) {
        console.log(`  ⚠️ Referenced athlete ${log.athleteId} not found, skipping`);
        stats.skipped++;
        continue;
      }
      
      // Check if the regimen has a creator
      if (!regimen.createdBy) {
        console.log(`  ⚠️ Regimen ${log.regimenId} has no createdBy field, skipping`);
        stats.skipped++;
        continue;
      }
      
      // Get the coach
      const coach = await User.findById(regimen.createdBy);
      if (!coach) {
        console.log(`  ⚠️ Coach ${regimen.createdBy} not found, skipping`);
        stats.skipped++;
        continue;
      }
      
      console.log(`  🔄 Processing coach-athlete relationship for:
  - Coach: ${coach.email || coach._id}
  - Athlete: ${athlete.email || athlete._id}
  - Regimen: ${regimen.name} (${regimen._id})`);
      
      // Track if we needed to fix anything for this log
      let needsFixes = false;
      
      // 1. Check if coach has athlete in their athletes array
      if (!coach.athletes.map(id => id.toString()).includes(athlete._id.toString())) {
        console.log(`  ➕ Adding athlete ${athlete._id} to coach's athletes array`);
        coach.athletes.push(athlete._id);
        await coach.save();
        stats.fixed.coachToAthlete++;
        needsFixes = true;
      }
      
      // 2. Check if athlete has coach in their coaches array
      if (!athlete.coaches.map(id => id.toString()).includes(coach._id.toString())) {
        console.log(`  ➕ Adding coach ${coach._id} to athlete's coaches array`);
        athlete.coaches.push(coach._id);
        await athlete.save();
        stats.fixed.athleteToCoach++;
        needsFixes = true;
      }
      
      // 3. Check if regimen has athlete in its assignedTo array
      if (!regimen.assignedTo.map(id => id.toString()).includes(athlete._id.toString())) {
        console.log(`  ➕ Adding athlete ${athlete._id} to regimen's assignedTo array`);
        regimen.assignedTo.push(athlete._id);
        await regimen.save();
        stats.fixed.regimenToAthlete++;
        needsFixes = true;
      }
      
      if (needsFixes) {
        stats.fixed.anyFixes++;
        console.log('  ✅ Fixed relationship issues for this log');
      } else {
        console.log('  ✓ All relationships already correct for this log');
      }
    }
    
    // Print summary
    console.log(`\n📋 Repair Summary:
- Processed ${stats.processed} workout logs
- Skipped ${stats.skipped} logs due to missing data
- Applied fixes to ${stats.fixed.anyFixes} logs
  - Added athletes to coaches: ${stats.fixed.coachToAthlete}
  - Added coaches to athletes: ${stats.fixed.athleteToCoach}
  - Added athletes to regimens: ${stats.fixed.regimenToAthlete}
`);
    
    console.log('✅ Workout log relationship repair process completed');
    
  } catch (error) {
    console.error('❌ Error fixing workout log relationships:', error);
  } finally {
    // Disconnect from MongoDB
    mongoose.disconnect();
    console.log('Disconnected from database');
  }
};

// Run the repair function
fixWorkoutLogRelationships(); 