import React, { createContext, useContext, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { toast } from "sonner";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("authToken") || "");
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUserProfile = async (userId) => {
    try {
      const res = await axiosInstance.get(`/users/profile/${userId}`);
      setUser(res.data);
      setTotalEarnings(res.data.total_earnings || 0);
      return res.data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      if (error?.response?.status === 401) {
        // Token expired or invalid
        logout();
      }
      return null;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("authToken");
      const storedUserId = localStorage.getItem("userId");

      if (storedToken && storedUserId) {
        setToken(storedToken);
        await fetchUserProfile(storedUserId);
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Refresh user profile periodically
  useEffect(() => {
    if (!user?._id) return;

    const refreshInterval = setInterval(() => {
      fetchUserProfile(user._id);
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [user?._id]);

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    setUser(null);
    setToken("");
    setTotalEarnings(0);
  };

  const updateProfile = async (data) => {
    try {
      const res = await axiosInstance.put("/users/update-profile", data);
      setUser(res.data.user);
      return res.data.user;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  const addBankAccount = async (data) => {
    try {
      const response = await axiosInstance.put("/users/attach-bank-account", data);
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      console.error("Error adding bank account:", error);
      setError(error?.response?.data?.message);
      throw error;
    }
  };

  const requestWithdrawal = async (data) => {
    try {
      const response = await axiosInstance.post("/users/withdraw", data);
      setTotalEarnings(0);
      return response.data;
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      throw error;
    }
  };

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        setToken,
        logout,
        updateProfile,
        addBankAccount,
        totalEarnings,
        setTotalEarnings,
        requestWithdrawal,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
