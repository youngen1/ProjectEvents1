const jwt = require('jsonwebtoken');
const User = require('../models/User'); 

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        console.log(" in auth middleware, token: ", token);

        if (!token) {
            return res.status(401).json({ message: 'No authentication token, access denied' });
        }

        const verified = jwt.verify(token, process.env.JWT_SECRET);

       console.log(" verified: ", verified);
        req.user = await User.findById(verified.id).select('-password'); // Find user and exclude password

        console.log(" user in auth middleware: ", req.user);
         if (!req.user) { //check if user exists
           return res.status(401).json({ message: "Unauthorized: Invalid User" });
        }

        next();
    } catch (err) {
        // IMPROVED ERROR HANDLING: Distinguish between different JWT errors
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Unauthorized: Invalid token' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Unauthorized: Token expired' });
        }
        // Fallback for other errors
        console.error("Auth middleware error:", err); // Log the full error
        res.status(500).json({ message: 'Internal Server Error' }); // 500 for unexpected errors
    }
};

module.exports = auth;