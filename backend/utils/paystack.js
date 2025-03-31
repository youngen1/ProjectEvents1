const axios = require("axios");
const functions = require("firebase-functions"); // For Firebase Functions
require("dotenv").config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
    throw new Error("Paystack secret key is not defined in environment variables");
}

const paystack = axios.create({
    baseURL: "https://api.paystack.co",
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
    },
});

const initializePayment = async (amount, email, callbackUrl) => {
    try {
        const response = await paystack.post("/transaction/initialize", {
            amount: Math.round(amount * 100), // Convert to kobo (NGN)
            email: email,
            callback_url: callbackUrl,
        });
        return response.data;
    } catch (error) {
        console.error("Error initializing payment:", error.response ? error.response.data : error.message);
        throw error; // Re-throw the original error
    }
};

const verifyPayment = async (reference) => {
    try {
        const response = await paystack.get(`/transaction/verify/${reference}`);
        return response.data;
    } catch (error) {
        console.error("Error verifying payment:", error.response ? error.response.data : error.message);
        throw error; // Re-throw the original error
    }
};

const fetchBanks = async () => {
    try {
        const response = await paystack.get("/bank");
        return response.data;
    } catch (error) {
        console.error("Error fetching banks:", error.response ? error.response.data : error.message);
        throw error; // Re-throw the original error
    }
};

const createTransferRecipient = async (authorizationCode, name) => {
    try {
        const response = await paystack.post("/transferrecipient", {
            type: "authorization",
            name,
            authorization_code: authorizationCode,
            currency: "NGN", // Use NGN (Nigerian Naira)
        });
        return response.data;
    } catch (error) {
        console.error("Error creating transfer recipient:", error.response ? error.response.data : error.message);
        throw error; // Re-throw the original error
    }
};

const initiateTransfer = async (amount, recipientCode) => {
    try {
        const response = await paystack.post("/transfer", {
            source: "balance",
            amount, // Keep amount handling consistent (kobo or original)
            recipient: recipientCode,
            reason: "Withdrawal",
        });
        return response.data;
    } catch (error) {
        console.error("Error initiating transfer:", error.response ? error.response.data : error.message);
        throw error; // Re-throw the original error
    }
};

const chargeCard = async (email, amount, cardDetails) => {
    try {
      const response = await paystack.post("/charge", {
        email,
        amount, // Amount in kobo
        card: {
          number: cardDetails.card_number,
          cvv: cardDetails.card_cvv,
          expiry_month: cardDetails.card_expiry_month,
          expiry_year: cardDetails.card_expiry_year,
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        "Error charging card:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
  };

module.exports = {
    initializePayment,
    verifyPayment,
    createTransferRecipient,
    initiateTransfer,
    fetchBanks,
    chargeCard, // Be EXTREMELY careful with this function
};