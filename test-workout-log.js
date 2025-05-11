const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const WorkoutLog = require('./models/WorkoutLog');
const User = require('./models/User');
const Regimen = require('./models/Regimen');

// Load environment variables
dotenv.config({ path: './server/config.env' });

// Read MONGO_URI directly from config file if not available in process.env
let MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  try {
    const configPath = path.resolve(__dirname, 'config.env');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const mongoUriMatch = configFile.match(/MONGO_URI=(.+?)(\r?\n|$)/);
    if (mongoUriMatch && mongoUriMatch[1]) {
      MONGO_URI = mongoUriMatch[1];
      console.log('Read MONGO_URI from config file');
    }
  } catch (err) {
    console.error('Error reading config file:', err);
  }
}

if (!MONGO_URI) {
  console.error('MONGO_URI not found in environment variables or config file');
  process.exit(1);
}

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Function to create a test workout log
const createTestWorkoutLog = async () => {
  try {
    console.log('Starting workout log test...');
    
    // 1. Find a coach
    const coach = await User.findOne({ role: 'coach' });
    if (!coach) {
      console.error('No coach found in the database');
      return;
    }
    console.log(`Found coach: ${coach.email} (${coach._id})`);
    
    // 2. Find an athlete assigned to this coach
    const athlete = await User.findOne({ 
      role: 'athlete',
      coaches: coach._id
    });
    
    if (!athlete) {
      console.error('No athlete found for this coach');
      return;
    }
    console.log(`Found athlete: ${athlete.email} (${athlete._id})`);
    
    // 3. Find a regimen assigned to this athlete
    const regimen = await Regimen.findOne({
      assignedTo: athlete._id
    });
    
    if (!regimen) {
      console.error('No regimen found assigned to this athlete');
      return;
    }
    console.log(`Found regimen: ${regimen.name} (${regimen._id})`);
    
    // 4. Create sample exercise logs
    const exerciseLogs = [
      {
        exerciseId: '1',
        name: 'Push-up',
        sets: 3,
        reps: 10,
        weight: 0,
        duration: 0,
        completed: true,
        notes: 'Felt good'
      },
      {
        exerciseId: '2',
        name: 'Squat',
        sets: 3,
        reps: 15,
        weight: 50,
        duration: 0,
        completed: true,
        notes: 'Increased weight'
      },
      {
        exerciseId: '3',
        name: 'Treadmill',
        sets: 1,
        reps: 1,
        weight: 0,
        duration: 900, // 15 minutes in seconds
        completed: true,
        notes: 'Good cardio session'
      }
    ];
    
    // 5. Create the workout log
    // Check for existing logs first
    const existingLogs = await WorkoutLog.find({ athleteId: athlete._id });
    console.log(`Found ${existingLogs.length} existing workout logs for this athlete`);
    
    const workoutLog = await WorkoutLog.create({
      athleteId: athlete._id,
      regimenId: regimen._id,
      regimenName: regimen.name,
      dayId: regimen.days && regimen.days.length > 0 ? regimen.days[0]._id : 'day1',
      dayName: regimen.days && regimen.days.length > 0 ? regimen.days[0].name : 'Day 1',
      rating: 8,
      difficulty: 'Medium',
      notes: 'Great workout session, felt energized afterward.',
      completed: true,
      completedAt: new Date(),
      duration: 45, // 45 minutes
      exercises: exerciseLogs
    });
    
    console.log('✅ Successfully created test workout log:');
    console.log(`ID: ${workoutLog._id}`);
    console.log(`Athlete: ${athlete.email} (${athlete._id})`);
    console.log(`Regimen: ${regimen.name} (${regimen._id})`);
    console.log(`Date: ${workoutLog.completedAt}`);
    console.log(`Exercise count: ${workoutLog.exercises.length}`);
    
    // 6. Verify the log was created
    const allLogs = await WorkoutLog.find({});
    console.log(`Total workout logs in database: ${allLogs.length}`);
    
    // 7. List all logs for debugging
    console.log('\nAll workout logs in the database:');
    allLogs.forEach((log, index) => {
      console.log(`${index + 1}. ID: ${log._id}, Athlete: ${log.athleteId}, Regimen: ${log.regimenName}, Date: ${log.completedAt}`);
    });
    
  } catch (error) {
    console.error('Error creating test workout log:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the function
createTestWorkoutLog(); 