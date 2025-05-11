const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars from config.env file
dotenv.config({ path: './config.env' });

// Import User model
const User = require('./models/User');

async function migrateToMultipleCoaches() {
  try {
    console.log('Starting migration to multiple coaches model...');
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGO_URI ? 'URI exists' : 'URI is missing');
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Find all athletes with a coach but without the coaches array populated
    const athletes = await User.find({ 
      role: 'athlete',
      coachId: { $exists: true, $ne: null },
      $or: [
        { coaches: { $exists: false } },
        { coaches: { $size: 0 } }
      ]
    });
    
    console.log(`Found ${athletes.length} athletes to migrate`);
    
    // Counter for tracking progress
    let migratedCount = 0;
    
    // Process each athlete
    for (const athlete of athletes) {
      console.log(`Processing athlete: ${athlete.firstName} ${athlete.lastName} (${athlete.email})`);
      console.log(`- Current coachId: ${athlete.coachId}`);
      
      // Initialize coaches array if it doesn't exist
      if (!athlete.coaches) {
        athlete.coaches = [];
      }
      
      // Set primary coach to current coach
      athlete.primaryCoachId = athlete.coachId;
      
      // Add coach to coaches array if not already there
      if (!athlete.coaches.some(id => id && id.toString() === athlete.coachId.toString())) {
        athlete.coaches.push(athlete.coachId);
        console.log(`- Added coach ${athlete.coachId} to coaches array`);
      } else {
        console.log(`- Coach ${athlete.coachId} already in coaches array`);
      }
      
      // Save changes
      await athlete.save({ validateBeforeSave: false });
      
      migratedCount++;
      console.log(`✓ Migrated athlete ${athlete.email} successfully`);
    }
    
    console.log('\nMigration Summary:');
    console.log(`Successfully migrated ${migratedCount} athletes to the multiple coaches model`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Only run the migration if the file is executed directly
if (require.main === module) {
  migrateToMultipleCoaches()
    .then(() => console.log('Migration script completed'))
    .catch(err => console.error('Migration script failed:', err));
}

module.exports = migrateToMultipleCoaches; 