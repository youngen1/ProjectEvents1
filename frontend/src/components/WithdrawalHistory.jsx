import React, { useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { Toaster } from "sonner";
import NavBar from "./NavBar";


const WithdrawalHistory = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWithdrawalHistory = async () => {
      try {
        const response = await axiosInstance.get("/users/withdrawals-history");
        setWithdrawals(response.data);
      } catch (error) {
        console.error("Error fetching withdrawal history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawalHistory();
  }, []);

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <>
    <Toaster richColors />
      <NavBar />
      <div className="max-w-7xl mx-auto pt-20 py-8 px-2">
        
      <h2 className="text-2xl font-semibold mb-4">Withdrawal History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">ID</th>
              <th className="py-3 px-6 text-left">Amount (ZAR)</th>
              <th className="py-3 px-6 text-left">Status</th>
              <th className="py-3 px-6 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="text-gray-600 text-sm font-light">
            {withdrawals.length > 0 ? (
              withdrawals.map((withdrawal) => (
                <tr key={withdrawal._id} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="py-3 px-6">{withdrawal._id}</td>
                  <td className="py-3 px-6">{(withdrawal.amount / 100).toFixed(2)}</td>
                  <td className="py-3 px-6">{withdrawal.status}</td>
                  <td className="py-3 px-6">{new Date(withdrawal.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="py-3 px-6 text-center">No withdrawal history found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    
    </>
   
  );
};

export default WithdrawalHistory;
