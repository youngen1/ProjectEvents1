import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from "../../utils/axiosInstance";
import { toast, Toaster } from 'sonner';

const VerifyPayment = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [hasVerified, setHasVerified] = useState(false); // State to track if verification has occurred

    useEffect(() => {
        const verifyPayment = async () => {
            const queryParams = new URLSearchParams(location.search);
            const reference = queryParams.get('reference');
            const eventId = queryParams.get('eventId');
            const userId = queryParams.get('userId');

            try {
                const response = await axiosInstance.get(`/events/payment/verify?reference=${reference}&eventId=${eventId}&userId=${userId}`);
                if (response.data.success) {
                    toast.success(response.data.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    window.location.href = `https://www.eventcircle.site/single-event/${eventId}`;
                } else {
                    toast.error(response.data.message);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    window.location.href = `https://www.eventcircle.site/single-event/${eventId}`;
                }
            } catch (error) {
                toast.error('An error occurred while verifying the payment.');
                window.location.href = error.response?.data?.redirectUrl ;
                
            }
        };

        // Run only if verification has not already occurred
        if (!hasVerified) {
            verifyPayment();
            setHasVerified(true); // Set flag to true after first verification
        }
    }, [location, navigate, hasVerified]);

    return (
        <div>
            <Toaster richColors />
            <h1>Verifying Payment...</h1>
        </div>
    );
};

export default VerifyPayment;
