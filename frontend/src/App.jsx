import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate
} from "react-router-dom";

import Login from "./pages/Login/Login";
import ChangePassword from "./pages/Change-password/ChangePassword";
import ChangePasswordAfterLogin from "./pages/Change-password/ChangePasswordAfterLogin";
import Signup from "./pages/Signup/Signup";
import Events from "./pages/Events/Events";
import AddNewEvent from "./pages/Events/AddNewEvent";
import EventDetails from "./pages/Events/EventDetails";
import VerifyPayment from "./pages/Events/VerifyPayment";
import MyTickets from "./pages/MyTickets/MyTickets";
import { useEffect, useState } from "react";
import UpdateProfile from "./pages/UpdateProfile/UpdateProfile";
import UserProfile from "./pages/UpdateProfile/UserProfile";
import { useAuth } from "./context/AuthContext";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage/PrivacyPolicyPage";
import Forgot from "./pages/forgot-password/Forgot";
import VerifyEmail from "./pages/verify-email/VerifyUser";
import PlatformEarnings from './pages/Admin/PlatformEarnings';
import AdminRoute from './components/AdminRoute';
import axiosInstance from './utils/axiosInstance';
import { app } from './utils/firebaseConfig'; // Import the initialized Firebase app
import testUtil from './utils/testUtils.js';
import Contact from "./pages/Contact/Contact"; // Import the Contact component
import AboutUs from "./pages/AboutUs/AboutUs"; // Import the AboutUs component
import WithdrawalHistory from "./components/WithdrawalHistory.jsx";
import Finance from "./pages/UpdateProfile/Finanace.jsx";

console.log(testUtil()); // Should log "Hello from test utils!"

console.log("axiosInstance imported:", axiosInstance); // Check if it's defined

console.log("App component rendered");

console.log("Firebase API Key:", process.env.REACT_APP_FIREBASE_API_KEY);

function App() {
  const { setUser, user } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    console.log("App component mounted");

    const fetchUser = async () => {
      try {
        console.log("About to fetch user profile");
        const res = await axiosInstance.get(`/users/profile/${localStorage.userId}`);
        console.log("User profile response:", res?.data);
        setUser(res.data);
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    if (localStorage.token && localStorage.userId) {
      fetchUser();
    }

    const fetchEvents = async () => {
      console.log("About to fetch events");

      try {
        const response = await axiosInstance.get('/events/viewAll'); // Correct path for fetching all events
        console.log("Events response:", response);

        if (response.status !== 200) { // Check for successful status
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = response.data; // Use response.data for Axios
        console.log("Events data:", data);
        setEvents(data);

      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    fetchEvents();

  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Signup />} />
        <Route path="/forgot-password" element={<Forgot />} />
        <Route path="/reset-password/:id" element={<ChangePassword />} />
        <Route path="/change-password" element={<ChangePasswordAfterLogin />} />
        <Route path="/verify-email/:id" element={<VerifyEmail />} />

        {/* Protected Routes */}
        <Route path="/add-event" element={user ? <AddNewEvent /> : <Navigate to="/login" />} />
        <Route path="/my-tickets" element={user ? <MyTickets /> : <Navigate to="/login" />} />
        <Route path="/show-profile" element={user ? <UpdateProfile /> : <Navigate to="/login" />} />
        <Route path="/user-profile/:id" element={user ? <UserProfile /> : <Navigate to="/login" />} />
        <Route path="/single-event/:id" element={user ? <EventDetails /> : <Navigate to="/login" />} />
        <Route path="/withdrawal-history" element={user ? <Finance /> : <Navigate to="/login" />} />

        {/* Public Routes */}
        <Route path="/events" element={<Events />} />
        <Route path="/verify-payment" element={<VerifyPayment />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/contact" element={<Contact />} /> {/* Add the Contact route */}
        <Route path="/about-us" element={<AboutUs />} /> {/* Add the About Us route */}

        {/* Default Route */}
        <Route path="/" element={<Events />} />

        {/* Admin Routes */}
        <Route
          path="/admin/earnings"
          element={
            <AdminRoute>
              <PlatformEarnings />
            </AdminRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
