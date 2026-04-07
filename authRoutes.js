const express = require('express');
const {
    registerUser,
    loginUser,
    verifyOTP,
    resendOTP,
} = require('../controllers/authController');
const { registerValidation, loginValidation } = require('../utils/validators');

const router = express.Router();

router.post('/register', registerValidation, registerUser);
router.post('/login', loginValidation, loginUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

module.exports = router;
