const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars from config.env file
dotenv.config({ path: './config.env' });

// Import models
const User = require('./models/User');
const Regimen = require('./models/Regimen');

async function checkRegimenAssignments() {
  try {
    console.log('=== REGIMEN ASSIGNMENT CHECKER ===');
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    // Get all athletes
    const athletes = await User.find({ role: 'athlete' }).populate('regimens');
    console.log(`Found ${athletes.length} athletes`);
    
    // Check each athlete
    for (const athlete of athletes) {
      console.log(`\nChecking athlete: ${athlete.firstName} ${athlete.lastName} (${athlete.email})`);
      
      // Check if athlete has regimens array
      console.log(`Regimens array exists: ${!!athlete.regimens}`);
      console.log(`Regimens array length: ${athlete.regimens ? athlete.regimens.length : 0}`);
      
      // Find regimens that have this athlete in assignedTo
      const assignedRegimens = await Regimen.find({ assignedTo: athlete._id });
      console.log(`Regimens with athlete in assignedTo: ${assignedRegimens.length}`);
      
      // Compare the two sets
      const regimenIdsInUser = athlete.regimens ? athlete.regimens.map(r => r._id ? r._id.toString() : r.toString()) : [];
      const regimenIdsInAssignedTo = assignedRegimens.map(r => r._id.toString());
      
      console.log(`Regimen IDs in athlete.regimens: ${regimenIdsInUser.length > 0 ? regimenIdsInUser.join(', ') : 'none'}`);
      console.log(`Regimen IDs in assignedTo: ${regimenIdsInAssignedTo.length > 0 ? regimenIdsInAssignedTo.join(', ') : 'none'}`);
      
      // Check for mismatches
      const inUserButNotAssigned = regimenIdsInUser.filter(id => !regimenIdsInAssignedTo.includes(id));
      const assignedButNotInUser = regimenIdsInAssignedTo.filter(id => !regimenIdsInUser.includes(id));
      
      if (inUserButNotAssigned.length > 0) {
        console.log(`WARNING: Found ${inUserButNotAssigned.length} regimens in user.regimens but not in assignedTo`);
        console.log(`  IDs: ${inUserButNotAssigned.join(', ')}`);
        
        // Fix this issue by adding the athlete to the regimen's assignedTo array
        console.log('Attempting to fix missing athlete in regimen.assignedTo');
        for (const regimenId of inUserButNotAssigned) {
          console.log(`  Adding athlete ${athlete._id} to regimen ${regimenId} assignedTo array`);
          await Regimen.findByIdAndUpdate(
            regimenId,
            { $addToSet: { assignedTo: athlete._id } }
          );
        }
        console.log('Fix applied. Please check again.');
      }
      
      if (assignedButNotInUser.length > 0) {
        console.log(`WARNING: Found ${assignedButNotInUser.length} regimens in assignedTo but not in user.regimens`);
        console.log(`  IDs: ${assignedButNotInUser.join(', ')}`);
        
        // Check if we should fix this automatically
        console.log('Attempting to fix missing regimens in user.regimens');
        for (const regimenId of assignedButNotInUser) {
          console.log(`  Adding regimen ${regimenId} to athlete.regimens`);
          await User.findByIdAndUpdate(
            athlete._id,
            { $addToSet: { regimens: regimenId } }
          );
        }
        console.log('Fix applied. Please check again.');
      }
      
      // Check athlete's coaches
      console.log(`Primary coach: ${athlete.primaryCoachId || 'none'}`);
      console.log(`Legacy coachId: ${athlete.coachId || 'none'}`);
      console.log(`Coaches array: ${athlete.coaches && athlete.coaches.length > 0 ? 
        athlete.coaches.map(c => c.toString()).join(', ') : 'none'}`);
    }
    
    // List all regimens
    const regimens = await Regimen.find();
    console.log(`\nFound ${regimens.length} total regimens`);
    
    for (const regimen of regimens) {
      console.log(`\nChecking regimen: ${regimen.name} (ID: ${regimen._id})`);
      console.log(`Created by: ${regimen.createdBy}`);
      console.log(`Assigned to ${regimen.assignedTo ? regimen.assignedTo.length : 0} athletes`);
      
      if (regimen.assignedTo && regimen.assignedTo.length > 0) {
        for (const athleteId of regimen.assignedTo) {
          const athlete = await User.findById(athleteId);
          if (!athlete) {
            console.log(`  WARNING: Athlete ${athleteId} not found but assigned to regimen`);
            continue;
          }
          
          // Check if athlete has this regimen in their regimens array
          const hasRegimen = athlete.regimens && 
            athlete.regimens.some(r => r.toString() === regimen._id.toString());
          
          console.log(`  Athlete ${athlete.firstName} ${athlete.lastName} (${athlete.email})`);
          console.log(`    Has regimen in their regimens array: ${hasRegimen ? 'Yes' : 'No'}`);
          
          if (!hasRegimen) {
            console.log('    Fixing: Adding regimen to athlete.regimens');
            await User.findByIdAndUpdate(
              athleteId,
              { $addToSet: { regimens: regimen._id } }
            );
          }
        }
      }
    }
    
    console.log('\n=== CHECKER COMPLETE ===');
    
  } catch (error) {
    console.error('Error running checker:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the checker
checkRegimenAssignments()
  .then(() => console.log('Checker completed'))
  .catch(err => console.error('Checker failed:', err)); 