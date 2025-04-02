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
const functions = require("firebase-functions")
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

// exports.loginUser = async (req, res) => {
//   const { email, password } = req.body;

//   try {

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     // Check if the user's email is verified


//     // If user is verified, check the password
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }
//     if (!user.isVerified) {
//       // Generate a token for email verification
//       const verificationToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
//       console.log('verificationToken: ', verificationToken);
//       // Send email verification
//       const resetLink = `${FRONTEND_URL}/verify-email/${verificationToken}`;
//       console.log('resetLink: ', resetLink);

//       const transporter = nodemailer.createTransport({
//         host: EMAIL_HOST,
//         port: EMAIL_PORT,
//         auth: {
//           user: EMAIL_USER,
//           pass: EMAIL_PASSWORD
//         }
//       });

//       console.log('transporter: ', transporter);

//       try { // <---------------------- ADDED: try block for email sending
//         await transporter.sendMail({
//           from: EMAIL_USER,  // Sender email
//           to: email,  // Receiver email
//           subject: 'Email Verification',
//           html: `<p>Click the link below to verify your email:</p>
//                  <a href="${resetLink}">Verify Email</a>
//                  <p>This link will expire in 1 hour.</p>`,
//         });
//         console.log('Email sent successfully');
//       } catch (emailError) { // <------------------ ADDED: catch block for email sending errors
//         console.error("Error sending verification email:", emailError); // Log the email error
//         return res.status(500).json({  // Return 500 with an email-specific error message
//           message: "Error sending verification email. Please try again later.",
//           errorDetails: emailError.message, // Include error details for debugging (optional, remove in production)
//         });
//       }


//       return res.status(400).json({
//         message: 'Your email is not verified. A verification link has been sent to your email.',
//       });
//     }

//     // Generate a JWT token for login
//     const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

//     const userWithoutPassword = await User.findOne({ email })
//       .select("fullname username email profile_picture followers following my_tickets")
//       .populate({
//         path: "followers following",
//         select: "fullname username profile_picture"
//       });

//     res.status(200).json({
//       message: "User login successful",
//       token,
//       user: userWithoutPassword,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.loginUser = async (req, res) => {
  console.log('\n=== LOGIN REQUEST RECEIVED ===');
  console.log('Request body:', req.body);
  
  const { email, password } = req.body;
  console.log('Email:', email, 'Password:', password );

  try {
    console.log('\n=== LOOKING FOR USER IN DATABASE ===');
    const user = await User.findOne({ email });
    console.log('User found:', user ? user : 'No user found');

    if (!user) {
      console.log('ERROR: No user found with this email');
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log('\n=== CHECKING PASSWORD ===');

  
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      console.log('ERROR: Password does not match');
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log('\n=== CHECKING EMAIL VERIFICATION STATUS ===');
    console.log('Is verified:', user.isVerified);

    if (!user.isVerified) {
      console.log('\n=== GENERATING VERIFICATION TOKEN ===');
      const verificationToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
      console.log('Verification token generated:', verificationToken);
      
      const resetLink = `${FRONTEND_URL}/verify-email/${verificationToken}`;
      console.log('Verification link:', resetLink);

      console.log('\n=== CREATING EMAIL TRANSPORTER ===');
      const transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        auth: {
          user: 'truecirclevents@gmail.com',
          pass: 'erugjdsslvbyxiki'
        }
      });
      console.log('Transporter created with host:', EMAIL_HOST);

      try {
        console.log('\n=== SENDING VERIFICATION EMAIL ===');
        const mailInfo = await transporter.sendMail({
          from: 'truecirclevents@gmail.com',
          to: email,
          subject: 'Email Verification',
          html: `<p>Click the link below to verify your email:</p>
                 <a href="${resetLink}">Verify Email</a>
                 <p>This link will expire in 1 hour.</p>`,
        });
        console.log('Email sent successfully:', mailInfo.response);
        
        return res.status(400).json({
          message: 'Your email is not verified. A verification link has been sent to your email.',
        });
      } catch (emailError) {
        console.error('\n=== ERROR SENDING EMAIL ===');
        console.error('Error details:', emailError);
        console.error('Stack trace:', emailError.stack);
        
        return res.status(500).json({
          message: "Error sending verification email. Please try again later.",
          errorDetails: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
        });
      }
    }

    console.log('\n=== GENERATING AUTH TOKEN ===');
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    console.log('Auth token generated');

    console.log('\n=== FETCHING USER WITHOUT PASSWORD ===');
    const userWithoutPassword = await User.findOne({ email })
      .select("fullname username email profile_picture followers following my_tickets")
      .populate({
        path: "followers following",
        select: "fullname username profile_picture"
      });
    console.log('User data prepared for response');

    console.log('\n=== LOGIN SUCCESSFUL ===');
    res.status(200).json({
      message: "User login successful",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('\n=== UNEXPECTED ERROR ===');
    console.error('Error:', error);
    console.error('Stack trace:', error.stack);
    console.error('Request body:', req.body);
    
    res.status(500).json({ 
      message: "An unexpected error occurred",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateUserProfile = async (req, res) => {
  const userId = req.user.id;
  const { fullname, dateOfBirth, phone_number, profile_picture, username } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if username is being updated and validate it
    if (username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });

      if (existingUser) {
        return res.status(400).json({
          message: "Username is already taken"
        });
      }

      // Validate username format
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

    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    res
      .status(200)
      .json({ message: "Bank account attached successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyTickets = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).populate({
      path: "my_tickets",
      populate: {
        path: "created_by",
        select: "fullname username email profile_picture",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.my_tickets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getWithdrawalHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    const withdrawals = await Withdrawal.find({ user: userId })
      .sort({ createdAt: -1 });

    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.requestWithdrawal = async (req, res) => {
  const userId = req.user.id;
  const { card_number, card_expiry_month, card_expiry_year, card_cvv } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const amountToWithdraw = user.total_earnings * 100; // Paystack amount should be in kobo (NGN)

    if (amountToWithdraw <= 5000) {
      return res.status(400).json({
        message: "Amount must be greater than NGN 50 to request a withdrawal",
      });
    }

    // Create withdrawal record
    const withdrawal = new Withdrawal({
      user: userId,
      amount: amountToWithdraw,
      status: "pending"
    });

    await withdrawal.save();

    // Charge the card to get authorization code
    const chargeResponse = await chargeCard(user.email, amountToWithdraw, {
      card_number,
      card_expiry_month,
      card_expiry_year,
      card_cvv,
    });

    if (chargeResponse.data.status !== "success") {
      withdrawal.status = "failed";
      await withdrawal.save();
      return res.status(400).json({ message: "Failed to charge card" });
    }

    const authorization_code = chargeResponse.data.authorization.authorization_code;

    // Create transfer recipient using the authorization code
    const recipientData = await createTransferRecipient(
      authorization_code,
      user.fullname
    );
    const recipient_code = recipientData.data.recipient_code;

    // Initiate transfer
    const transferData = await initiateTransfer(amountToWithdraw, recipient_code);

    if (transferData.status === "success") {
      // Update withdrawal status
      withdrawal.status = "completed";
      await withdrawal.save();

      // Update user's earnings
      user.total_earnings = 0;
      await user.save();

      res.status(200).json({
        message: "Withdrawal request successful. Amount transferred to your card.",
        amount: amountToWithdraw / 100,
      });
    } else {
      withdrawal.status = "failed";
      await withdrawal.save();
      res.status(400).json({ message: "Transfer failed" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.followUser = async (req, res) => {
  const userId = req.user.id;
  const { followId } = req.params; // ID of the user to follow

  try {
    const user = await User.findById(userId);
    const followUser = await User.findById(followId);

    if (!followUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add the followId to the following array if not already followed
    if (!user.following.includes(followId)) {
      await User.updateOne(
        { _id: userId },
        { $addToSet: { following: followId } }
      );
    }

    // Add the userId to the followers array of the followUser
    if (!followUser.followers.includes(userId)) {
      await User.updateOne(
        { _id: followId },
        { $addToSet: { followers: userId } }
      );
    }

    res.status(200).json({ message: "User followed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.unfollowUser = async (req, res) => {
  const userId = req.user.id;
  const { followId } = req.params; // ID of the user to unfollow

  try {
    const user = await User.findById(userId);
    const followUser = await User.findById(followId);

    if (!followUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove the followId from the following array
    user.following = user.following.filter(id => id.toString() !== followId);
    await user.save();

    // Remove the userId from the followers array of the followUser
    followUser.followers = followUser.followers.filter(id => id.toString() !== userId);
    await followUser.save();

    res.status(200).json({ message: "User unfollowed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getUserById = async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  try {
    // Include username and other public fields, exclude sensitive data
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID format' }); // 400 Bad Request
    }
    const user = await User.findById(userId)
      .select("fullname username email profile_picture followers following my_tickets role")
      .populate({
        path: "followers following",
        select: "fullname username profile_picture role"
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFollowers = async (req, res) => {
  const { userId } = req.params;
try {
  const user = await User.findById(userId).populate({
    path: "followers",
    select:
      "fullname username email profile_picture followers following my_tickets role",
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json(user.followers);
} catch (error) {
  res.status(500).json({ message: error.message });
}
};
exports.getFollowing = async (req, res) => {
const { userId } = req.params;
try {
  const user = await User.findById(userId).populate({
    path: "following",
    select:
      "fullname username email profile_picture followers following my_tickets role",
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json(user.following);
} catch (error) {
  res.status(500).json({ message: error.message });
}
};
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    console.log('user: ', user);
    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    // Generate a token (valid for 1 hour)
    const token = jwt.sign({ id: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Send password reset email
    const resetLink = `${FRONTEND_URL}/reset-password/${token}`;
    const transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
      }
    });

    try { // <---------------------- ADDED: try block for email sending
      await transporter.sendMail({
        from: EMAIL_USER,
        to: email,
        subject: "Password Reset Request",
        html: `<p>Click the link below to reset your password:</p>
               <a href="${resetLink}">Reset Password</a>
               <p>This link will expire in 1 hour.</p>`,
      });
      res.status(200).json({ message: "Password reset email sent" });
    } catch (emailError) { // <------------------ ADDED: catch block for email sending errors
      console.error("Error sending password reset email:", emailError); // Log the email error
      return res.status(500).json({  // Return 500 with an email-specific error message
        message: "Error sending password reset email. Please try again later.",
        errorDetails: emailError.message, // Include error details for debugging (optional, remove in production)
      });
    }


  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "Invalid token or user not found" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.body;

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    user.isVerified = true;
    await user.save();

    // Respond with success message
    res.status(200).json({ message: "Email verified successfully! You can now log in." });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred during email verification" });
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

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
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

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
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
    // Get all successful transactions/tickets
    const tickets = await Ticket.find({ status: "confirmed" });

    // Calculate total earnings (assuming 13% platform fee)
    const totalEarnings = tickets.reduce((sum, ticket) => {
      return sum + (ticket.price * 0.13);
    }, 0);

    // Get monthly breakdown
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
