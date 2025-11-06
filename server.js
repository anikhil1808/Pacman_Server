const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;; // Choose a port for your backend

// IMPORTANT: Replace this with your actual MongoDB Atlas connection string
// Example: mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/?retryWrites=true&w=majority
const uri = "mongodb+srv://sf_svce:Nikhil5678@pacman-leaderboard.b1gdhet.mongodb.net/?appName=pacman-leaderboard"; 

let db; // Global variable to hold the database connection

// --- Middleware ---
app.use(cors()); // Allows requests from your game's domain/localhost
app.use(express.json()); // Parses incoming JSON payloads

// --- MongoDB Connection Function ---
async function connectToMongo() {
    const client = new MongoClient(uri);
    try {
        console.log("Connecting to MongoDB Atlas...");
        await client.connect();
        db = client.db('pacman_leaderboard_db'); // Connect to your database
        console.log("Successfully connected to MongoDB!");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1); // Exit if connection fails
    }
}

// --- API Endpoint: Submit Score ---
app.post('/api/submit_score', async (req, res) => {
    if (!db) {
        return res.status(500).json({ success: false, message: "Database not connected." });
    }
    
    const playerName = (req.body.playerName || 'Anonymous').toUpperCase();
    const scoreValue = parseInt(req.body.score) || 0;
    
    if (scoreValue <= 0) {
        return res.json({ success: false, message: "Score must be positive." });
    }

    try {
        const result = await db.collection('high_scores').insertOne({
            player_name: playerName,
            score: scoreValue,
            date_achieved: new Date() 
        });

        res.json({ success: true, message: "Score submitted successfully.", id: result.insertedId });
    } catch (error) {
        console.error("Error inserting score:", error);
        res.status(500).json({ success: false, message: "Error submitting score." });
    }
});

// --- API Endpoint: Get Leaderboard ---
app.get('/api/get_leaderboard', async (req, res) => {
    if (!db) {
        return res.status(500).json({ success: false, message: "Database not connected." });
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
        console.log(`Server running at http://localhost:${port}`);
    });
});