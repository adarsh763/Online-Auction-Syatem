const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { logUserToExcel, markVerifiedInExcel } = require('../utils/excelLogger');
const { sendOTP } = require('../utils/emailService');

// Generate JWT Helper
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @desc    Register a new user
 * @route   POST /api/register
 * @access  Public
 */
const registerUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { name, email, password } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        const user = await User.create({
            name,
            email,
            password,
            otp,
            otpExpires,
            isVerified: false
        });

        // Send OTP
        await sendOTP(user.email, user.name, otp);
        
        // Log to Excel
        await logUserToExcel({ name, email, password: '***' });

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your email to log in.',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

/**
 * @desc    Verify OTP
 * @route   POST /api/verify-otp
 * @access  Public
 */
const verifyOTP = async (req, res) => {
    try {
        const { email, otp: rawOtp } = req.body;
        const otp = (rawOtp || '').trim();

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required' });
        }

        // Fetch user with otp fields (they might be excluded by default)
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otp +otpExpires');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        // Debug logging
        console.log(`🔍 OTP Verify — email: ${email}, input: "${otp}", stored: "${user.otp}", expires: ${user.otpExpires}, now: ${new Date()}`);

        if (!user.otp) {
            return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please check the code and try again.' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        await markVerifiedInExcel(user.email);

        console.log(`✅ Email verified successfully for ${email}`);
        res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during verification' });
    }
};

/**
 * @desc    Resend OTP
 * @route   POST /api/resend-otp
 * @access  Public
 */
const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        await sendOTP(user.email, user.name, otp);

        res.status(200).json({ success: true, message: 'A new OTP has been sent to your email.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error resending OTP' });
    }
};

/**
 * @desc    Login user
 * @route   POST /api/login
 * @access  Public
 */
const loginUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password } = req.body;

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(403).json({ success: false, message: 'Email not verified. Please verify your OTP.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        res.status(200).json({
            success: true,
            data: {
                token: generateToken(user._id),
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    verifyOTP,
    resendOTP,
};
