import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosInstance';
import { useAuth } from '../../context/AuthContext';

const PlatformEarnings = () => {
    const [earnings, setEarnings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        const fetchEarnings = async () => {
            try {
               
                const response = await axiosInstance.get('/events/admin/earnings');
                if (response.data) {
                    setEarnings(response.data);
                } else {
                    setError('No earnings data available');
                }
            } catch (err) {
                // Improved error handling:  More specific error messages.
                if (err.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    setError(`Server Error: ${err.response.status} - ${err.response.data.message || 'Unknown Error'}`);
                  } else if (err.request) {
                    // The request was made but no response was received
                    setError('Network Error: No response received from server.');
                  } else {
                    // Something happened in setting up the request that triggered an Error
                    setError('Request Error: ' + err.message);
                  }
            } finally {
                setLoading(false);
            }
        };

        if (user?.isAdmin) {
            fetchEarnings();
        }
    }, [user]);


    if (!user?.isAdmin) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    Access Denied: Admin privileges required
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    Error: {error}
                </div>
            </div>
        );
    }

    // Check if earnings and totalEarnings exist before accessing properties
    if (!earnings || !earnings.totalEarnings) {
        return (
          <div className="container mx-auto px-4 py-8">
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
              No earnings data to display.
            </div>
          </div>
        );
    }


    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Platform Earnings</h1>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Total Earnings</h2>
                <p className="text-2xl text-green-600">
                    R{earnings.total_earnings.toFixed(2)}
                </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Earnings Breakdown</h2>
                <div className="space-y-4">
                    {earnings.earnings && earnings.earnings.length > 0 ? ( // Corrected condition
                        earnings.earnings.map((earning) => (  // Corrected variable name
                            <div key={earning._id} className="flex justify-between items-center border-b pb-2">
                                <span>
                                    {/* Display event details and date */}
                                    {earning.event ? `${earning.event.event_title} - ${new Date(earning.event.event_date_and_time).toLocaleString()}` : 'Unknown Event'}
                                </span>
                                <span className="font-semibold">
                                   R{earning.amount ? earning.amount.toFixed(2): '0.00'}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="text-gray-500">No earnings data available</div>
                    )}
                </div>
           </div>
       </div>
    );
};

export default PlatformEarnings;
