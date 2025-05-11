const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './config.env' });

// Import User model
const User = require('./models/User');

async function createTestAthlete() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Find coach account
    const coach = await User.findOne({ role: 'coach' });
    if (!coach) {
      console.log('No coach found! Please create a coach account first.');
      return;
    }
    
    console.log(`Found coach: ${coach.email}`);
    
    // Create multiple test athletes
    const athletesData = [
      {
        firstName: 'Alex',
        lastName: 'Johnson',
        email: 'alex.johnson@example.com',
        password: 'password123',
        role: 'athlete',
        sport: 'Basketball',
        level: 'Intermediate',
        isEmailVerified: true
      },
      {
        firstName: 'Sam',
        lastName: 'Wilson',
        email: 'sam.wilson@example.com',
        password: 'password123',
        role: 'athlete',
        sport: 'Football',
        level: 'Advanced',
        isEmailVerified: true
      },
      {
        firstName: 'Taylor',
        lastName: 'Smith',
        email: 'taylor.smith@example.com',
        password: 'password123',
        role: 'athlete',
        sport: 'Swimming',
        level: 'Beginner',
        isEmailVerified: true
      }
    ];
    
    let addedAthletes = 0;
    
    // Process each athlete
    for (const data of athletesData) {
      // Set coach ID for each athlete
      data.coachId = coach._id;
      
      // Check if athlete already exists
      let athlete = await User.findOne({ email: data.email });
      
      if (athlete) {
        console.log(`${data.firstName} ${data.lastName} already exists, updating coach reference`);
        athlete.coachId = coach._id;
        athlete.sport = data.sport;
        athlete.level = data.level;
        await athlete.save();
      } else {
        // Create athlete
        athlete = await User.create(data);
        console.log(`Created new athlete: ${data.firstName} ${data.lastName}`);
        addedAthletes++;
      }
      
      // Add to coach's athletes array if not already there
      if (!coach.athletes) {
        coach.athletes = [];
      }
      
      if (!coach.athletes.some(id => id && id.equals && id.equals(athlete._id))) {
        coach.athletes.push(athlete._id);
        console.log(`Added ${data.firstName} ${data.lastName} to coach athletes array`);
      } else {
        console.log(`${data.firstName} ${data.lastName} already in coach athletes array`);
      }
    }
    
    // Save coach with updated athletes array
    await coach.save();
    
    console.log('\nTest athletes setup complete!');
    console.log(`Added ${addedAthletes} new athletes`);
    console.log(`Coach now has ${coach.athletes.length} athletes in their array`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestAthlete(); 