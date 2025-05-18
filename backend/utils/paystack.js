const Paystack = require('paystack-node');

/**
 * @typedef {Object} PaymentInitializeParams
 * @property {string} email
 * @property {number} amount - in kobo (smallest currency unit)
 * @property {string} [reference]
 * @property {string} [callback_url]
 * @property {any} [metadata]
 */

/**
 * @typedef {Object} VerifyPaymentParams
 * @property {string} reference
 * @property {string|number} [amount] - Optional amount for mock payments
 */

class PaystackService {
    constructor() {
        this.paystack = null;
        this.initialize();
    }

    /**
     * Initialize the Paystack API client with the appropriate key
     */
    initialize() {
        // For R2 test event, always use live mode
        process.env.PAYSTACK_MODE = 'live';

        // Always use the live key for the R2 event
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
            throw new Error('PAYSTACK_SECRET_KEY is required for live payments but is missing');
        }

        // Fix: Paystack-Node doesn't actually support environment parameter in constructor
        this.paystack = new Paystack(secretKey);

        // Log that we're using live mode
        console.log(`Paystack initialized in LIVE mode with correct environment settings.`);

        // Debug to check the Paystack client was created properly
        console.log(`Paystack client initialized: ${!!this.paystack}`);
    }

    /**
     * Reinitialize the Paystack API client with updated keys
     */
    reinitialize() {
        this.initialize();
        console.log('Paystack service reinitialized with updated settings');
    }

    /**
     * Initialize a transaction and get a payment URL
     * @param {PaymentInitializeParams} params - Payment initialization parameters
     * @returns {Promise<Object>} Transaction data
     */
    async initializeTransaction(params) {
        try {
            console.log('Initializing Paystack transaction in ZAR:', {
                email: params.email,
                amount: params.amount,
                reference: params.reference
            });

            // Convert ZAR amount to smallest currency unit (cents)
            // Make sure it's always in South African Rands
            const amountInCents = Math.round(params.amount * 100);

            console.log(`Processing payment: R${params.amount} → ${amountInCents} cents (ZAR)`);

            // Convert metadata to JSON string if it exists (Paystack requires metadata as string)
            const metadataString = params.metadata ? JSON.stringify(params.metadata) : undefined;

            // Using live Paystack API for all transactions with explicit ZAR currency
            const response = await this.paystack.initializeTransaction({
                email: params.email,
                amount: amountInCents,
                currency: "ZAR", // Explicitly specify South African Rand
                reference: params.reference,
                callback_url: params.callback_url,
                metadata: metadataString
            });

            if (!response.body.status) {
                throw new Error(response.body.message || 'Failed to initialize transaction');
            }

            console.log('Paystack transaction initialization successful:', {
                reference: response.body.data.reference,
                authUrl: response.body.data.authorization_url
            });

            return response.body.data;
        } catch (error) {
            console.error('Paystack initialize transaction error:', error);
            throw new Error(error.message || 'Could not initialize payment');
        }
    }

    /**
     * Verify a payment using the transaction reference
     * @param {VerifyPaymentParams} params - Payment verification parameters
     * @returns {Promise<Object>} Verification data
     */
    async verifyPayment(params) {
        try {
            console.log('Verifying Paystack payment with reference:', params.reference);

            // Always using real Paystack API for verification
            const response = await this.paystack.verifyTransaction({
                reference: params.reference
            });

            if (!response.body.status) {
                throw new Error(response.body.message || 'Failed to verify transaction');
            }

            // Verify currency is ZAR
            if (response.body.data.currency !== 'ZAR') {
                console.warn(`Warning: Payment currency is ${response.body.data.currency}, expected ZAR`);
            }

            // Convert amount from cents back to Rands for better readability in logs
            const amountInRands = response.body.data.amount / 100;

            console.log('Paystack payment verification successful:', {
                reference: response.body.data.reference,
                status: response.body.data.status,
                amount: `R${amountInRands.toFixed(2)}`,
                amountInCents: response.body.data.amount,
                currency: response.body.data.currency || 'ZAR'
            });

            return response.body.data;
        } catch (error) {
            console.error('Paystack verify payment error:', error);
            throw new Error(error.message || 'Could not verify payment');
        }
    }

    /**
     * Get a list of available payment channels (banks)
     * @returns {Promise<Array<Object>>} List of payment channels
     */
    async getPaymentChannels() {
        try {
            try {
                const response = await this.paystack.listPaymentChannels();

                if (response && response.body && response.body.status && response.body.data) {
                    return response.body.data;
                }
            } catch (apiError) {
                console.error('Error fetching banks from Paystack API:', apiError);
            }

            // Fallback - return static list of major banks in South Africa
            console.log('Using fallback bank list for Paystack');
            return [
                { id: 1, name: "ABSA Bank", slug: "absa-bank" },
                { id: 2, name: "Capitec Bank", slug: "capitec-bank" },
                { id: 3, name: "First National Bank", slug: "fnb" },
                { id: 4, name: "Nedbank", slug: "nedbank" },
                { id: 5, name: "Standard Bank", slug: "standard-bank" },
                { id: 6, name: "African Bank", slug: "african-bank" },
                { id: 7, name: "Bidvest Bank", slug: "bidvest-bank" },
                { id: 8, name: "Discovery Bank", slug: "discovery-bank" },
                { id: 9, name: "Investec", slug: "investec" },
                { id: 10, name: "TymeBank", slug: "tyme-bank" },
                { id: 11, name: "Bank Zero", slug: "bank-zero" },
                { id: 12, name: "Grobank", slug: "grobank" },
                { id: 13, name: "VBS Mutual Bank", slug: "vbs-mutual-bank" },
                { id: 14, name: "Ubank", slug: "ubank" },
                { id: 15, name: "Sasfin Bank", slug: "sasfin-bank" }
            ];
        } catch (error) {
            console.error('Error in getPaymentChannels:', error);
            // If everything fails, return a minimal list
            return [
                { id: 1, name: "ABSA Bank", slug: "absa-bank" },
                { id: 2, name: "Capitec Bank", slug: "capitec-bank" },
                { id: 3, name: "First National Bank", slug: "fnb" },
                { id: 4, name: "Nedbank", slug: "nedbank" },
                { id: 5, name: "Standard Bank", slug: "standard-bank" }
            ];
        }
    }
}

// Export singleton instance
const paystackService = new PaystackService();

/**
 * Initialize a payment transaction with Paystack
 * @param {number} amount - Amount in kobo (smallest currency unit)
 * @param {string} email - Customer's email address
 * @param {string} callbackUrl - URL to redirect to after payment
 * @returns {Promise<Object>} - Payment initialization data
 */
const initializePayment = async (amount, email, callbackUrl) => {
    try {
        console.log('Calling initializePayment wrapper function with:', { amount, email, callbackUrl });
        return await paystackService.initializeTransaction({
            amount: amount, // amount is already in kobo
            email: email,
            callback_url: callbackUrl
        });
    } catch (error) {
        console.error('Error in initializePayment wrapper:', error);
        throw error;
    }
};

/**
 * Verify a payment transaction with Paystack
 * @param {string} reference - Payment reference to verify
 * @returns {Promise<Object>} - Payment verification data
 */
const verifyPayment = async (reference) => {
    try {
        console.log('Calling verifyPayment wrapper function with reference:', reference);
        return await paystackService.verifyPayment({
            reference: reference
        });
    } catch (error) {
        console.error('Error in verifyPayment wrapper:', error);
        throw error;
    }
};

// Export the functions and service using CommonJS syntax
module.exports = {
    paystackService,
    initializePayment,
    verifyPayment
};
