const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Check if we can read the database URL from the environment
console.log('Reading database configuration...');
if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL not found in environment, checking .env file directly');
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
      if (dbUrlMatch && dbUrlMatch[1]) {
        process.env.DATABASE_URL = dbUrlMatch[1];
        console.log('Found DATABASE_URL in .env file');
      }
    }
  } catch (err) {
    console.error('Error reading .env file:', err);
  }
}

// Fallback to local MongoDB if no URL is found
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

const fixWorkoutLogAssociations = async () => {
  try {
    console.log('Starting workout log association fix process...');
    
    // Get all workout logs
    const workoutLogs = await WorkoutLog.find();
    console.log(`Found ${workoutLogs.length} workout logs total`);
    
    // Check each workout log
    for (const log of workoutLogs) {
      console.log(`\nChecking workout log ${log._id} for regimen ${log.regimenId} by athlete ${log.athleteId}`);
      
      // Get the regimen
      const regimen = await Regimen.findById(log.regimenId);
      if (!regimen) {
        console.log(`  ⚠️ Referenced regimen ${log.regimenId} not found, skipping`);
        continue;
      }
      
      // Get the athlete
      const athlete = await User.findById(log.athleteId);
      if (!athlete) {
        console.log(`  ⚠️ Referenced athlete ${log.athleteId} not found, skipping`);
        continue;
      }
      
      // Check if the regimen has a creator
      if (!regimen.createdBy) {
        console.log(`  ⚠️ Regimen ${log.regimenId} has no createdBy field`);
        continue;
      }
      
      // Get the coach
      const coach = await User.findById(regimen.createdBy);
      if (!coach) {
        console.log(`  ⚠️ Coach ${regimen.createdBy} not found, skipping`);
        continue;
      }
      
      console.log(`  Coach: ${coach.email || coach._id}, Athlete: ${athlete.email || athlete._id}`);
      
      // Fix the coach-athlete relationship if needed
      let updated = false;
      
      // Check if athlete has the coach in their coaches array
      if (!athlete.coaches.includes(coach._id)) {
        console.log(`  ➕ Adding coach ${coach._id} to athlete's coaches array`);
        athlete.coaches.push(coach._id);
        updated = true;
      }
      
      // Check if coach has the athlete in their athletes array
      if (!coach.athletes.includes(athlete._id)) {
        console.log(`  ➕ Adding athlete ${athlete._id} to coach's athletes array`);
        coach.athletes.push(athlete._id);
        updated = true;
      }
      
      // Check if athlete is assigned to the regimen
      if (!regimen.assignedTo.includes(athlete._id)) {
        console.log(`  ➕ Adding athlete ${athlete._id} to regimen's assignedTo array`);
        regimen.assignedTo.push(athlete._id);
        await regimen.save();
        console.log(`  ✅ Updated regimen ${regimen._id}`);
      }
      
      // Save updates to athlete and coach if needed
      if (updated) {
        await athlete.save();
        await coach.save();
        console.log(`  ✅ Updated athlete and coach relationship`);
      } else {
        console.log(`  ✓ Athlete-coach relationship already correct`);
      }
    }
    
    console.log('\nFix process completed successfully');
    
  } catch (error) {
    console.error('Error fixing workout log associations:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from database');
  }
};

// Run the fix
fixWorkoutLogAssociations(); 