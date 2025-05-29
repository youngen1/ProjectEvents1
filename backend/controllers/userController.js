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

    if (!["male", "female", "other"].includes(gender)) {
      return res.status(400).json({ message: "Invalid gender" });
    }

    const newUser = new User({
      fullname,
      dateOfBirth,
      email,
      phone_number,
      password,
      profile_picture,
      gender
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      const resetLink = `${FRONTEND_URL}/verify-email/${verificationToken}`;

      const transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASSWORD
        }
      });

      try {
        await transporter.sendMail({
          from: 'truecirclevents@gmail.com',
          to: email,
          subject: 'Email Verification',
          html: `<p>Click the link below to verify your email:</p>
                 <a href="${resetLink}">Verify Email</a>
                 <p>This link will expire in 1 hour.</p>`,
        });

        return res.status(200).json({
          message: 'Your email is not verified. A verification link has been sent to your email.',
          requiresVerification: true
        });
      } catch (emailError) {
        return res.status(500).json({
          message: "Error sending verification email. Please try again later.",
          errorDetails: process.env.NODE_ENV === 'development' ? emailError.message : undefined
        });
      }
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    const userWithoutPassword = await User.findOne({ email })
      .select("fullname username email profile_picture followers following my_tickets")
      .populate({
        path: "followers following",
        select: "fullname username profile_picture"
      });

    res.status(200).json({
      message: "User login successful",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({
      message: "An unexpected error occurred",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.changePasswordAfterLogin = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.makeAdmin = async (req, res) => {
  try {
    const adminEmail = "mtswenisabelo301@gmail.com";
    const user = await User.findOne({ email: adminEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = "admin";
    await user.save();

    const updatedUser = await User.findOne({ email: adminEmail });

    res.status(200).json({ message: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Error making user admin", error: error.message });
  }
};

exports.manualPasswordReset = async (req, res) => {
  try {
    const email = "mtswenisabelo301@gmail.com";
    const newPassword = "272756321";

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      message: "Password has been reset successfully",
      user: {
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPlatformEarnings = async (req, res) => {
  try {
    const tickets = await Ticket.find({ status: "confirmed" });
    const totalEarnings = tickets.reduce((sum, ticket) => {
      return sum + (ticket.price * 0.13);
    }, 0);

    const monthlyEarnings = await Ticket.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          earnings: { $sum: { $multiply: ["$price", 0.13] } }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } }
    ]);

    res.status(200).json({
      totalEarnings,
      monthlyEarnings
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching platform earnings", error: error.message });
  }
};
