const nodemailer = require('nodemailer');

/**
 * Create a reusable SMTP transporter.
 * Uses Gmail by default. For other providers, change the `service` field.
 *
 * Required .env vars:
 *   EMAIL_USER   — Your Gmail address (e.g. yourname@gmail.com)
 *   EMAIL_PASS   — A Gmail App Password (NOT your normal password)
 *
 * How to get a Gmail App Password:
 *   1. Go to https://myaccount.google.com/security
 *   2. Enable 2-Step Verification if not already enabled
 *   3. Go to https://myaccount.google.com/apppasswords
 *   4. Select "Mail" and your device, then generate a 16-character password
 *   5. Paste that password into EMAIL_PASS in your .env file
 */
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

/**
 * Sends an OTP to the given email address via Nodemailer (Gmail SMTP).
 *
 * @param {string} email - The recipient email.
 * @param {string} name - The recipient name.
 * @param {string} otp - The 6-digit OTP code to send.
 */
const sendOTP = async (email, name, otp) => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    // Fallback to console if credentials are missing
    if (!emailUser || !emailPass) {
        console.log('\n=========================================');
        console.log('📧 [MOCK EMAIL] Credentials not configured!');
        console.log('   Add EMAIL_USER and EMAIL_PASS to your .env');
        console.log(`   To: ${email} (${name})`);
        console.log(`   OTP: ${otp}`);
        console.log('=========================================\n');
        return true;
    }

    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"Uni Shipping Bids ⚡" <${emailUser}>`,
            to: email,
            subject: '🔐 Your Uni Shipping Bids Verification Code',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); border-radius: 16px; color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: #a78bfa; margin: 0; font-size: 28px;">⚡ Uni Shipping Bids</h1>
                        <p style="color: #94a3b8; margin-top: 4px;">Real-Time Auction Platform</p>
                    </div>
                    <div style="background: rgba(255,255,255,0.08); border-radius: 12px; padding: 28px; text-align: center; border: 1px solid rgba(167,139,250,0.2);">
                        <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 8px;">Hello <strong>${name}</strong>,</p>
                        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px;">Use the code below to verify your email address:</p>
                        <div style="background: rgba(167,139,250,0.15); border: 2px dashed #a78bfa; border-radius: 10px; padding: 18px; margin: 0 auto; display: inline-block;">
                            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #a78bfa; font-family: 'Courier New', monospace;">${otp}</span>
                        </div>
                        <p style="color: #f87171; font-size: 13px; margin-top: 20px;">⏱ This code expires in <strong>10 minutes</strong></p>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
                        If you didn't request this code, you can safely ignore this email.
                    </p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Verification email sent to ${email} — Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        console.error('⚠️  Registration will proceed, but the user did not receive the OTP email.');
        console.error('   Check EMAIL_USER and EMAIL_PASS in your .env file.');
        return false;
    }
};

module.exports = { sendOTP };
