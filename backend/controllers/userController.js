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
    gender,  // Include gender in the request body
  } = req.body;

  try {
    // Check if the email is already registered

    console.log(" details from request body: ", req.body);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Validate the gender field
    if (!["male", "female", "other"].includes(gender)) {
      return res.status(400).json({ message: "Invalid gender" });
    }

    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);

    // console.log(" ==========registering===========")
    // console.log(" password from request: ", password);
    // console.log(" password in database: ", hashedPassword);

    // const testHash = await bcrypt.hash('qwertyui', salt);
    // console.log(" testhash: ", testHash);
    // const testMatch = await bcrypt.compare('qwertyui', testHash);
    // const isMatch = await bcrypt.compare('qwertyui', hashedPassword);

    // console.log(" during testing, testMatch:", testMatch ," and isMatch: ", isMatch);

    // console.log(" ==========registering===========")
    const newUser = new User({
      fullname,
      dateOfBirth,
      email,
      phone_number,
      password,
      profile_picture,
      gender,  // Save gender in the user model
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/**
 * Login user
 * @route POST /api/users/login
 * @param {object} req.body
 * @param {string} req.body.email - User's email
 * @param {string} req.body.password - User's password
 */
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

      try {
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
      } catch (emailError) {
        return res.status(500).json({
          message: "Error sending verification email",
          error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
        });
      }
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
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Request password reset
 * @route POST /api/users/forgot-password
 * @param {object} req.body
 * @param {string} req.body.email - User's email
 */
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
        <p>You requested to reset your password. Click the link below:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (error) {
    res.status(500).json({
      message: "Error sending password reset email",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Change password after login
 * @route POST /api/users/change-password
 * @param {object} req.body
 * @param {string} req.body.currentPassword - Current password
 * @param {string} req.body.newPassword - New password
 */
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error changing password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify email address
 * @route POST /api/users/verify-user
 * @param {object} req.body
 * @param {string} req.body.token - Verification token
 */
exports.verifyEmail = async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: "Email already verified" });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "Email verified successfully! You can now log in." });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: "Invalid token" });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: "Token has expired" });
    }
    res.status(500).json({
      message: "Error verifying email",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get withdrawal history
 * @route GET /api/users/withdrawals-history
 */
exports.getWithdrawalHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const withdrawals = await Withdrawal.find({ user: userId })
      .sort({ createdAt: -1 })
      .select('amount status createdAt transactionReference');

    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching withdrawal history",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get platform earnings (admin only)
 * @route GET /api/users/platform-earnings
 */
exports.getPlatformEarnings = async (req, res) => {
  try {
    const tickets = await Ticket.find({ status: "confirmed" });
    const totalEarnings = tickets.reduce((sum, ticket) => {
      return sum + (ticket.price * 0.13); // 13% platform fee
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
    res.status(500).json({
      message: "Error fetching platform earnings",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Request withdrawal
 * @route POST /api/users/withdraw
 * @param {object} req.body
 * @param {string} req.body.card_number - Card number
 * @param {string} req.body.card_expiry_month - Card expiry month
 * @param {string} req.body.card_expiry_year - Card expiry year
 * @param {string} req.body.card_cvv - Card CVV
 */
exports.requestWithdrawal = async (req, res) => {
  const userId = req.user.id;
  const { card_number, card_expiry_month, card_expiry_year, card_cvv } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const amountToWithdraw = Math.round(user.total_earnings * 100); // Convert to kobo

    if (amountToWithdraw < 5000) { // Minimum 50 NGN
      return res.status(400).json({
        message: "Minimum withdrawal amount is NGN 50"
      });
    }

    const withdrawal = new Withdrawal({
      user: userId,
      amount: amountToWithdraw,
      status: "pending"
    });
    await withdrawal.save();

    try {
      const chargeResult = await chargeCard(user.email, amountToWithdraw, {
        card_number,
        card_expiry_month,
        card_expiry_year,
        card_cvv
      });

      if (!chargeResult.status) {
        withdrawal.status = "failed";
        await withdrawal.save();
        return res.status(400).json({ message: "Card charge failed" });
      }

      const recipientData = await createTransferRecipient(
        chargeResult.data.authorization.authorization_code,
        user.fullname
      );

      const transfer = await initiateTransfer(
        amountToWithdraw,
        recipientData.data.recipient_code
      );

      if (transfer.status) {
        withdrawal.status = "completed";
        withdrawal.transactionReference = transfer.data.reference;
        await withdrawal.save();

        user.total_earnings = 0;
        await user.save();

        return res.status(200).json({
          message: "Withdrawal successful",
          amount: amountToWithdraw / 100,
          reference: transfer.data.reference
        });
      }

      withdrawal.status = "failed";
      await withdrawal.save();
      return res.status(400).json({ message: "Transfer failed" });
    } catch (paymentError) {
      withdrawal.status = "failed";
      await withdrawal.save();
      return res.status(500).json({
        message: "Payment processing failed",
        error: process.env.NODE_ENV === 'development' ? paymentError.message : undefined
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error processing withdrawal",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Attach bank account
 * @route PUT /api/users/attach-bank-account
 * @param {object} req.body
 * @param {string} req.body.bank_account_number - Bank account number
 * @param {string} req.body.bank_code - Bank code
 */
exports.attachBankAccount = async (req, res) => {
  const userId = req.user.id;
  const { bank_account_number, bank_code } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.bank_account_number = bank_account_number;
    user.bank_code = bank_code;
    await user.save();

    const updatedUser = await User.findById(userId)
      .select("bank_account_number bank_code");

    res.status(200).json({
      message: "Bank account attached successfully",
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      message: "Error attaching bank account",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Reset password using token
 * @route POST /api/users/reset-password
 * @param {object} req.body - Reset data
 * @param {string} req.body.token - Reset token
 * @param {string} req.body.newPassword - New password
 */
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "Invalid token or user not found" });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successful. You can now log in with your new password." });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: "Invalid token" });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
    }
    res.status(500).json({
      message: "Error resetting password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Manual password reset (admin only)
 * @route POST /api/users/manual-password-reset
 * @param {object} req.body - Manual reset data
 */
exports.manualPasswordReset = async (req, res) => {
  try {
    const email = "mtswenisabelo301@gmail.com"; // Hardcoded for security
    const newPassword = "272756321"; // Hardcoded default password

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    // Send email notification
    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: "Your Password Has Been Reset",
      html: `
        <h2>Password Reset Notification</h2>
        <p>Your password has been reset to the default password.</p>
        <p>Please log in and change your password immediately.</p>
        <p>Default password: ${newPassword}</p>
      `
    });

    res.status(200).json({
      message: "Password has been reset successfully and email sent",
      user: { email: user.email }
    });
  } catch (error) {
    res.status(500).json({
      message: "Error resetting password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/users/update-profile
 * @param {object} req.body - Profile data
 */
exports.updateUserProfile = async (req, res) => {
  const userId = req.user.id;
  const { fullname, dateOfBirth, phone_number, profile_picture, username } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username) {
      const existingUser = await User.findOne({
        username,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
          message: "Username can only contain letters, numbers and underscores"
        });
      }
      user.username = username;
    }

    if (fullname) user.fullname = fullname;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (phone_number) user.phone_number = phone_number;
    if (profile_picture) user.profile_picture = profile_picture;

    await user.save();

    // Return updated user without sensitive data
    const updatedUser = await User.findById(userId)
      .select("fullname username email profile_picture dateOfBirth phone_number");

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating profile",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's tickets
 * @route GET /api/users/my-tickets
 * @returns {Array} List of user's tickets
 */
exports.getMyTickets = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).populate({
      path: "my_tickets",
      populate: [
        {
          path: "created_by",
          select: "fullname username email profile_picture"
        },
        {
          path: "event",
          select: "title description date location price image"
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.my_tickets);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching tickets",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Follow a user
 * @route POST /api/users/follow/:followId
 * @param {string} req.params.followId - ID of user to follow
 */
exports.followUser = async (req, res) => {
  const userId = req.user.id;
  const { followId } = req.params;

  try {
    if (userId === followId) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    const [user, userToFollow] = await Promise.all([
      User.findById(userId),
      User.findById(followId)
    ]);

    if (!userToFollow) {
      return res.status(404).json({ message: "User to follow not found" });
    }

    if (user.following.includes(followId)) {
      return res.status(400).json({ message: "Already following this user" });
    }

    // Add to following/followers lists
    user.following.push(followId);
    userToFollow.followers.push(userId);

    await Promise.all([user.save(), userToFollow.save()]);

    res.status(200).json({ message: "Successfully followed user" });
  } catch (error) {
    res.status(500).json({
      message: "Error following user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Unfollow a user
 * @route POST /api/users/unfollow/:followId
 * @param {string} req.params.followId - ID of user to unfollow
 */
exports.unfollowUser = async (req, res) => {
  const userId = req.user.id;
  const { followId } = req.params;

  try {
    const [user, userToUnfollow] = await Promise.all([
      User.findById(userId),
      User.findById(followId)
    ]);

    if (!userToUnfollow) {
      return res.status(404).json({ message: "User to unfollow not found" });
    }

    // Remove from following/followers lists
    user.following = user.following.filter(id => id.toString() !== followId);
    userToUnfollow.followers = userToUnfollow.followers.filter(id => id.toString() !== userId);

    await Promise.all([user.save(), userToUnfollow.save()]);

    res.status(200).json({ message: "Successfully unfollowed user" });
  } catch (error) {
    res.status(500).json({
      message: "Error unfollowing user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user profile by ID
 * @route GET /api/users/profile/:userId
 * @param {string} req.params.userId - User ID to fetch
 */
exports.getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const user = await User.findById(userId)
      .select("fullname username email profile_picture followers following my_tickets role total_earnings")
      .populate({
        path: "followers following",
        select: "fullname username profile_picture role"
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user profile",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's followers
 * @route GET /api/users/get-followers/:userId
 * @param {string} req.params.userId - User ID whose followers to fetch
 */
exports.getFollowers = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).populate({
      path: "followers",
      select: "fullname username email profile_picture followers following my_tickets role"
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.followers);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching followers",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get users being followed
 * @route GET /api/users/get-following/:userId
 * @param {string} req.params.userId - User ID whose following list to fetch
 */
exports.getFollowing = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).populate({
      path: "following",
      select: "fullname username email profile_picture followers following my_tickets role"
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.following);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching following list",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Make user an admin
 * @route POST /api/users/make-admin
 * @description Protected route to make a user an admin
 */
exports.makeAdmin = async (req, res) => {
  try {
    const adminEmail = "mtswenisabelo301@gmail.com";
    const user = await User.findOne({ email: adminEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: "User is already an admin" });
    }

    user.role = "admin";
    await user.save();

    // Send notification email
    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: EMAIL_USER,
      to: adminEmail,
      subject: "Admin Access Granted",
      html: `
        <h2>Admin Access Granted</h2>
        <p>You have been granted admin access to EventCircle.</p>
        <p>You now have access to additional features and controls.</p>
        <p>Please use this responsibility wisely.</p>
      `
    });

    res.status(200).json({
      message: "User has been made admin successfully",
      user: {
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Error making user admin",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

