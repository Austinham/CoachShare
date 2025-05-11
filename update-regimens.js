const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: './config.env' });

// Load MongoDB URI directly from config file
const envConfig = fs.readFileSync(path.join(__dirname, 'config.env'), 'utf8');
const mongoUriMatch = envConfig.match(/MONGO_URI=(.+)/);
const MONGO_URI = mongoUriMatch ? mongoUriMatch[1].trim() : null;

if (!MONGO_URI) {
  console.error('MongoDB URI not found in config.env');
  process.exit(1);
}

console.log('Using MongoDB URI:', MONGO_URI.substring(0, 25) + '...');

// Import models
const Regimen = require('./models/Regimen');
const User = require('./models/User');

async function updateRegimens() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Find a coach account to assign as creator for orphaned regimens
    const coaches = await User.find({ role: 'coach' });
    if (coaches.length === 0) {
      console.log('No coaches found. Please create a coach account first.');
      return;
    }
    
    console.log(`Found ${coaches.length} coaches:`);
    coaches.forEach(coach => {
      console.log(`- ${coach.email} (${coach._id})`);
    });
    
    // Get default coach (first one)
    const defaultCoach = coaches[0];
    console.log(`Using ${defaultCoach.email} as default coach for orphaned regimens`);
    
    // Find all regimens
    const regimens = await Regimen.find({});
    console.log(`Found ${regimens.length} total regimens`);
    
    // Count regimens with missing creator
    const orphanedRegimens = regimens.filter(r => !r.createdBy);
    console.log(`Found ${orphanedRegimens.length} regimens with missing creator`);
    
    if (orphanedRegimens.length > 0) {
      console.log('\nUpdating orphaned regimens...');
      
      // Update each orphaned regimen
      let updatedCount = 0;
      for (const regimen of orphanedRegimens) {
        console.log(`Updating regimen: ${regimen.name || 'unnamed'} (${regimen._id})`);
        
        try {
          // Use updateOne instead of save to bypass validation
          const result = await Regimen.updateOne(
            { _id: regimen._id },
            { $set: { createdBy: defaultCoach._id } },
            { validateBeforeSave: false }
          );
          
          console.log(`Updated regimen result:`, result);
          
          updatedCount++;
          console.log(`✅ Updated regimen ${updatedCount}/${orphanedRegimens.length}`);
        } catch (err) {
          console.error(`Failed to update regimen ${regimen._id}:`, err.message);
        }
      }
      
      console.log(`\nSuccessfully updated ${updatedCount} regimens with creator ID`);
    } else {
      console.log('No orphaned regimens found. All regimens have a valid creator.');
    }
    
    console.log('\nUpdating the regimens schema...');
    // Add an index for faster queries if it doesn't exist
    await Regimen.collection.createIndex({ createdBy: 1 });
    await Regimen.collection.createIndex({ assignedTo: 1 });
    
    console.log('Update complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update
updateRegimens(); 