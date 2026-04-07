const User = require('../models/User');

/**
 * Middleware: Protect routes (Auth Bypass Version).
 * Automatically finds or creates a 'Guest' user and attaches it to `req.user`.
 * This allows removing the need for JWT tokens/login.
 */
const protect = async (req, res, next) => {
    try {
        let guestUser = await User.findOne({ email: 'guest@example.com' });

        if (!guestUser) {
            // Create a default Guest user if it doesn't exist
            guestUser = await User.create({
                name: 'Guest Player',
                email: 'guest@example.com',
                password: 'defaultPassword123!', // Required by model, though not used
                isVerified: true,
            });
        }

        // Attach guest user to request
        req.user = guestUser;
        next();
    } catch (error) {
        console.error('Auth Bypass Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error providing guest access.',
        });
    }
};

module.exports = { protect };
