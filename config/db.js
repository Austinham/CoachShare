const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables if not already loaded (e.g., if running this file directly)
// Note: dotenv should ideally be loaded once at the entry point (start.js)
// dotenv.config({ path: './config.env' }); 

const connectDB = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI not found in environment variables. Ensure .env file is loaded correctly.');
        }
        // Mask credentials in log
        console.log('Using connection string:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//<credentials>@'));

        await mongoose.connect(mongoUri, {
            // useNewUrlParser and useUnifiedTopology are deprecated but might be needed for older versions
            // Add other recommended options if needed, e.g., autoIndex: true (for development)
            serverSelectionTimeoutMS: 10000 // Example: 10 seconds timeout
        });

        console.log('✅ MongoDB connected successfully');
        return true; // Indicate successful connection

    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('\n=================================================');
        console.log('📣 IMPORTANT: Connection failed. Potential issues:');
        console.log('1. IP Whitelisting: Your IP address needs to be whitelisted in MongoDB Atlas.');
        console.log('   Go to Network Access -> Add IP Address.');
        console.log('2. Connection String: Verify MONGO_URI in your .env file is correct.');
        console.log('3. Network Issues: Check your internet connection and firewall settings.');
        console.log('4. Local MongoDB: If using local DB, ensure it is running.');
        console.log('=================================================\n');
        // Throw the error so the caller (start.js) can handle it (e.g., exit the process)
        throw new Error(`MongoDB connection failed: ${err.message}`);
    }
};

module.exports = connectDB; 