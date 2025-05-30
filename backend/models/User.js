const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = mongoose.model("User", userSchema);
const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
    },
    dateOfBirth: { type: Date, required: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true, // Convert email to lowercase
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, // Better regex
            "Please fill a valid email address",
        ],
    },
    phone_number: { type: String, required: true },
    password: { type: String, required: true }, // Hashed password
    profile_picture: { type: String },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    total_earnings: { type: Number, default: 0 }, // Initialize to 0
    bank_account_number: { type: String }, // Encrypt this!
    bank_code: { type: String },            // Encrypt this!
    my_tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    isVerified: { type: Boolean, default: false },
    gender: {
        type: String,
        enum: ["male", "female", "other"],
        required: true,
    },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true }); // Add createdAt and updatedAt

// Hash the password before saving the user
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(this.password, salt);
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords (for login)
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        return false;
    }
};

// Virtual property for isAdmin
userSchema.virtual('isAdmin').get(function () {
    return this.role === 'admin';
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = User;