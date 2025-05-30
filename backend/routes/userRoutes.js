const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");
const adminMiddleware = require("../middlewares/admin");

router.post("/register", userController.registerUser);
router.post("/forgot-password", userController.requestPasswordReset);
router.post("/reset-password", userController.resetPassword);
router.post("/change-password", auth, userController.changePasswordAfterLogin);
router.post("/verify-user", userController.verifyEmail);



router.post("/login", userController.loginUser);

router.put("/update-profile", auth, userController.updateUserProfile);

router.put("/attach-bank-account", auth, userController.attachBankAccount);

router.get("/my-tickets", auth, userController.getMyTickets);

router.post("/withdraw", auth, userController.requestWithdrawal);

router.post("/follow/:followId", auth, userController.followUser);

router.post("/unfollow/:followId", auth, userController.unfollowUser);

router.get("/profile/:userId", userController.getUserById);

router.get("/withdrawals-history", auth, userController.getWithdrawalHistory);

router.post('/make-admin', userController.makeAdmin);

// router.post("/manual-password-reset", userController.manualPasswordReset);

router.get("/platform-earnings", auth, adminMiddleware, userController.getPlatformEarnings);
router.get('/get-followers/:userId', userController.getFollowers); 
router.get('/get-following/:userId', userController.getFollowing);
module.exports = router;
