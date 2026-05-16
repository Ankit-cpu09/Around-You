/**
 * OTP Service for Around You
 * Handles OTP generation, storage, verification, and delivery via Twilio SMS.
 * Falls back to console logging if Twilio credentials are not configured.
 */
const pool = require('../config/db');
const crypto = require('crypto');

// Twilio setup (only if credentials are provided)
let twilioClient = null;
let twilioPhone = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    console.log('📱 Twilio SMS integration enabled');
  } catch (err) {
    console.log('⚠️ Twilio module not available, using simulated OTP');
  }
} else {
  console.log('📱 Twilio not configured — OTPs will be shown on-screen & logged to console');
}

// Nodemailer setup for email-based password reset
let emailTransporter = null;
try {
  const nodemailer = require('nodemailer');
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    console.log('📧 Email integration enabled');
  } else {
    console.log('📧 Email not configured — email OTPs will be logged to console');
  }
} catch (err) {
  console.log('⚠️ Nodemailer issue:', err.message);
}

/**
 * Generate a 6-digit OTP code
 */
function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate and store an OTP for a given phone number
 * @param {string} phone - The phone number
 * @param {string} purpose - 'login' or 'reset_password'
 * @returns {object} - { code, expiresAt }
 */
async function generateOTP(phone, purpose) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  // Invalidate any existing unused OTPs for this phone + purpose
  await pool.query(
    'UPDATE otp_codes SET is_used = TRUE WHERE phone = ? AND purpose = ? AND is_used = FALSE',
    [phone, purpose]
  );

  // Store new OTP
  await pool.query(
    'INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES (?, ?, ?, ?)',
    [phone, code, purpose, expiresAt]
  );

  return { code, expiresAt };
}

/**
 * Send OTP via SMS using Twilio
 * @param {string} phone - The phone number (should include country code like +91)
 * @param {string} code - The OTP code
 * @param {string} purpose - 'login' or 'reset_password'
 * @returns {object} - { sent: boolean, method: string }
 */
async function sendSMS(phone, code, purpose) {
  const purposeText = purpose === 'login' ? 'login' : 'password reset';
  const message = `Your Around You ${purposeText} OTP is: ${code}. Valid for 5 minutes. Do not share this code.`;

  if (twilioClient && twilioPhone) {
    try {
      // Format phone for Twilio (needs +country code)
      let formattedPhone = phone;
      if (!phone.startsWith('+')) {
        formattedPhone = '+91' + phone; // Default to India
      }

      await twilioClient.messages.create({
        body: message,
        from: twilioPhone,
        to: formattedPhone
      });

      console.log(`📱 SMS sent to ${formattedPhone}`);
      return { sent: true, method: 'sms' };
    } catch (err) {
      console.error('❌ Twilio SMS failed:', err.message);
      // Fall through to simulated
    }
  }

  // Simulated — log to console
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📱 SIMULATED OTP for ${phone}`);
  console.log(`   Code: ${code}`);
  console.log(`   Purpose: ${purposeText}`);
  console.log(`   Expires: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleString()}`);
  console.log(`${'='.repeat(50)}\n`);

  return { sent: true, method: 'simulated' };
}

/**
 * Send OTP via Email
 * @param {string} email - The email address
 * @param {string} code - The OTP code
 * @returns {object} - { sent: boolean, method: string }
 */
async function sendEmail(email, code) {
  const htmlContent = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.3);">
      <div style="background: linear-gradient(135deg, #7c3aed, #a78bfa); padding: 32px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">⚡ Around You</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Password Reset</p>
      </div>
      <div style="padding: 32px; text-align: center;">
        <p style="color: #a0a0b0; font-size: 14px; margin: 0 0 24px;">Use the code below to reset your password. It expires in 5 minutes.</p>
        <div style="background: rgba(139, 92, 246, 0.1); border: 2px dashed rgba(139, 92, 246, 0.4); border-radius: 12px; padding: 20px; margin: 0 auto; display: inline-block;">
          <span style="font-size: 36px; font-weight: 800; color: #a78bfa; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #666; font-size: 12px; margin: 24px 0 0;">If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;

  if (emailTransporter) {
    try {
      await emailTransporter.sendMail({
        from: `"Around You" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Your Password Reset Code: ${code}`,
        html: htmlContent
      });
      console.log(`📧 Email sent to ${email}`);
      return { sent: true, method: 'email' };
    } catch (err) {
      console.error('❌ Email send failed:', err.message);
    }
  }

  // Simulated
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📧 SIMULATED EMAIL OTP for ${email}`);
  console.log(`   Code: ${code}`);
  console.log(`${'='.repeat(50)}\n`);

  return { sent: true, method: 'simulated' };
}

/**
 * Verify an OTP code
 * @param {string} phone - The phone number
 * @param {string} code - The OTP code to verify
 * @param {string} purpose - 'login' or 'reset_password'
 * @returns {boolean} - true if valid
 */
async function verifyOTP(phone, code, purpose) {
  const [rows] = await pool.query(
    `SELECT * FROM otp_codes 
     WHERE phone = ? AND code = ? AND purpose = ? AND is_used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code, purpose]
  );

  if (rows.length === 0) {
    return false;
  }

  // Mark as used
  await pool.query('UPDATE otp_codes SET is_used = TRUE WHERE id = ?', [rows[0].id]);
  return true;
}

/**
 * Cleanup expired OTPs (call periodically)
 */
async function cleanupExpiredOTPs() {
  try {
    await pool.query('DELETE FROM otp_codes WHERE expires_at < NOW() OR is_used = TRUE');
  } catch (err) {
    console.error('OTP cleanup error:', err.message);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredOTPs, 10 * 60 * 1000);

module.exports = { generateOTP, sendSMS, sendEmail, verifyOTP, cleanupExpiredOTPs };
