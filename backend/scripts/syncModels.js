const mongoose = require('mongoose');
const Event = require('../models/Event');
const PlatformEarning = require('../models/PlatformEarning');
const Review = require('../models/Review');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const path = require('path');
const functions = require('firebase-functions')

// Load environment variables from the correct path


async function syncModels() {
  // Check if MongoDB URI exists
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in environment variables');
    console.log('Please ensure you have a .env file with MONGODB_URI defined');
    console.log('Example MONGODB_URI format: mongodb://username:password@host:port/database');
    process.exit(1);
  }

  try {
    // Connect to MongoDB with additional options
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log('Connected to MongoDB successfully');

    // Get list of all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    console.log('Existing collections:', collectionNames);

    // Check and update each model
    const models = [
      { name: 'events', schema: Event },
      { name: 'platformearnings', schema: PlatformEarning },
      { name: 'reviews', schema: Review },
      { name: 'tickets', schema: Ticket },
      { name: 'users', schema: User },
      { name: 'withdrawals', schema: Withdrawal }
    ];

    for (const model of models) {
      if (collectionNames.includes(model.name)) {
        console.log(`\nChecking collection: ${model.name}`);
        
        // Get existing collection
        const collection = mongoose.connection.db.collection(model.name);
        
        // Get sample document
        const sampleDoc = await collection.findOne({});
        
        if (sampleDoc) {
          console.log(`Sample document from ${model.name}:`, sampleDoc);
          
          // Compare fields
          const schemaFields = Object.keys(model.schema.schema.paths);
          const documentFields = Object.keys(sampleDoc);
          
          console.log(`Schema fields for ${model.name}:`, schemaFields);
          console.log(`Document fields for ${model.name}:`, documentFields);
          
          // Find missing fields
          const missingInSchema = documentFields.filter(field => 
            !schemaFields.includes(field) && field !== '_id'
          );
          
          const missingInDocument = schemaFields.filter(field => 
            !documentFields.includes(field) && 
            field !== '_id' && 
            field !== '__v'
          );
          
          if (missingInSchema.length > 0) {
            console.log(`⚠️  Fields in document but not in schema for ${model.name}:`, missingInSchema);
          }
          
          if (missingInDocument.length > 0) {
            console.log(`⚠️  Fields in schema but not in document for ${model.name}:`, missingInDocument);
          }

          if (missingInSchema.length === 0 && missingInDocument.length === 0) {
            console.log(`✅ ${model.name} schema matches the database structure`);
          }
        } else {
          console.log(`ℹ️  No documents found in collection ${model.name}`);
        }
      } else {
        console.log(`\n⚠️  Collection ${model.name} does not exist yet`);
      }
    }

  } catch (error) {
    console.error('Error syncing models:', error.message);
    if (error.name === 'MongoServerSelectionError') {
      console.log('\nTips to resolve connection issues:');
      console.log('1. Check if your MongoDB server is running');
      console.log('2. Verify your MONGODB_URI is correct');
      console.log('3. Ensure your IP address is whitelisted in MongoDB Atlas');
      console.log('4. Check if your database username and password are correct');
    }
  } finally {
    if (mongoose.connection.readyState === 1) { // Connected
      await mongoose.connection.close();
      console.log('\nDatabase connection closed');
    }
  }
}

// Run the sync
syncModels(); 