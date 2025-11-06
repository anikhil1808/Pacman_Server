const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000; // Use the environment port for Render

// IMPORTANT: Your MongoDB Atlas connection string (use environment variable on Render)
const uri = process.env.MONGO_URI 

let db; // Global variable to hold the database connection

// --- Middleware ---
app.use(cors()); // Allows requests from your game's domain/localhost
app.use(express.json()); // Parses incoming JSON payloads

// --- MongoDB Connection Function ---
async function connectToMongo() {
    // Render environment uses the MONGO_URI environment variable
    const client = new MongoClient(uri);
    try {
        console.log("Connecting to MongoDB Atlas...");
        await client.connect();
        db = client.db('pacman_leaderboard_db'); // Connect to your database
        console.log("Successfully connected to MongoDB!");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        // Do NOT exit the process on Render if connection fails initially,
        // as Express must start to serve the health check route.
    }
}

// --- API Endpoint: Root Path (Health Check FIX) ---
// This handles the request from UptimeRobot, fixing the 404 error.
app.get('/', (req, res) => {
    // Check if the database connection object exists
    const dbStatus = db ? 'Connected' : 'Not Connected (Check logs)';
    
    // Respond with a 200 OK status and a JSON object
    res.json({ 
        status: 'API is running and awake!', 
        database: dbStatus 
    });
});

// --- API Endpoint: Submit Score ---
app.post('/api/submit_score', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, message: "Database not connected. Please try again." });
    }
    
    const playerName = (req.body.playerName || 'Anonymous').toUpperCase();
    const scoreValue = parseInt(req.body.score) || 0;
    
    if (scoreValue <= 0) {
        return res.json({ success: false, message: "Score must be positive." });
    }

    try {
        await db.collection('high_scores').insertOne({
            player_name: playerName,
            score: scoreValue,
            date_achieved: new Date() 
        });

        res.json({ success: true, message: "Score submitted successfully." });
    } catch (error) {
        console.error("Error inserting score:", error);
        res.status(500).json({ success: false, message: "Error submitting score." });
    }
});

// --- API Endpoint: Get Leaderboard ---
app.get('/api/get_leaderboard', async (req, res) => {
    if (!db) {
        return res.status(503).json({ success: false, message: "Database not connected. Please try again." });
    }

    try {
        const leaderboard = await db.collection('high_scores')
            .find({})
            .sort({ score: -1, date_achieved: 1 }) // Sort by score descending, then date ascending
            .limit(10)
            .toArray();

        // MongoDB stores the date as a Date object; format it for the frontend
        const formattedLeaderboard = leaderboard.map(doc => ({
            player_name: doc.player_name,
            score: doc.score,
            date_achieved: doc.date_achieved.toISOString().split('T')[0] // Format YYYY-MM-DD
        }));

        res.json({ success: true, leaderboard: formattedLeaderboard });

    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        res.status(500).json({ success: false, message: "Error fetching leaderboard." });
    }
});

// --- Start Server ---
connectToMongo().then(() => {
    app.listen(port, () => {
        console.log(`Server running at port ${port}`);
    });
});
