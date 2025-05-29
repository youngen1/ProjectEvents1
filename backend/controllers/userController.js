require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const nodemailer = require("nodemailer");
const {
  createTransferRecipient,
  initiateTransfer,
  chargeCard,
} = require("../utils/paystack");
const Ticket = require("../models/Ticket");
const functions = require("firebase-functions");
const JWT_SECRET = process.env.JWT_SECRET;
const mongoose = require('mongoose');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const FRONTEND_URL = process.env.FRONTEND_URL;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Create a reusable email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: EMAIL_HOST || 'smtp.gmail.com',
    port: EMAIL_PORT || 587,
    secure: EMAIL_PORT === '465',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD
    }
  });
};

exports.registerUser = async (req, res) => {
  const {
    fullname,
    dateOfBirth,
    email,
    phone_number,
    password,
    profile_picture,
    gender
  } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullname,
      dateOfBirth,
      email,
      phone_number,
      password: hashedPassword,
      profile_picture,
      gender,
      isVerified: false,
      followers: [],
      following: [],
      my_tickets: [],
      total_earnings: 0
    });

    await newUser.save();

    // Generate verification token and send email
    const verificationToken = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '1h' });
    const verificationLink = `${FRONTEND_URL}/verify-email/${verificationToken}`;

    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: 'Welcome to EventCircle - Email Verification',
      html: `
        <h2>Welcome to EventCircle!</h2>
        <p>Thank you for registering. Please click the link below to verify your email:</p>
        <a href="${verificationLink}">Verify Email</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `
    });

    res.status(201).json({
      message: "Registration successful. Please check your email for verification link.",
      requiresVerification: true
    });
  } catch (error) {
    res.status(500).json({
      message: "Registration failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      const verificationToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
      const verificationLink = `${FRONTEND_URL}/verify-email/${verificationToken}`;

      const transporter = createEmailTransporter();
      await transporter.sendMail({
        from: EMAIL_USER,
        to: email,
        subject: 'Email Verification Required',
        html: `
          <h2>Email Verification Required</h2>
          <p>Please click the link below to verify your email:</p>
          <a href="${verificationLink}">Verify Email</a>
          <p>This link will expire in 1 hour.</p>
        `
      });

      return res.status(200).json({
        message: 'Your email is not verified. A verification link has been sent to your email.',
        requiresVerification: true
      });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    const userWithoutPassword = await User.findOne({ email })
      .select("fullname username email profile_picture followers following my_tickets role")
      .populate({
        path: "followers following",
        select: "fullname username profile_picture"
      });

    res.status(200).json({
      message: "Login successful",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified. You can now log in." });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "Email verified successfully! You can now log in." });
  } catch (error) {
    res.status(500).json({
      message: "Email verification failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    const resetLink = `${FRONTEND_URL}/reset-password/${token}`;

    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to send password reset email",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "Invalid token or user not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(400).json({
      message: "Password reset failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ... rest of your existing functions ...
