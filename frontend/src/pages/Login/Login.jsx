import React, { useState, useCallback, memo, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast, Toaster } from "sonner";
import Footer from "../../components/Footer";
import Logo from "../../components/Logo";
import axiosInstance from "../../utils/axiosInstance";

// Memoize the validation schema
const validationSchema = Yup.object({
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
});

// Debounce function for input validation
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Memoize the Form component
const LoginForm = memo(({ formik, loading }) => {
  // Handle input focus for mobile keyboards
  const handleFocus = (e) => {
    const viewportHeight = window.innerHeight;
    const elementOffset = e.target.getBoundingClientRect().top;
    if (elementOffset > viewportHeight * 0.7) {
      setTimeout(() => window.scrollTo({ top: elementOffset - 100, behavior: 'smooth' }), 100);
    }
  };

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Email address
        </label>
        <div className="mt-2">
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            onFocus={handleFocus}
            {...formik.getFieldProps("email")}
            className={`block w-full rounded-md border-0 px-4 py-3 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 text-base ${
              formik.touched.email && formik.errors.email ? "ring-red-500" : ""
            }`}
          />
          {formik.touched.email && formik.errors.email ? (
            <div className="text-red-500 text-sm mt-1">{formik.errors.email}</div>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Password
        </label>
        <div className="mt-2">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            onFocus={handleFocus}
            {...formik.getFieldProps("password")}
            className={`block w-full rounded-md border-0 px-4 py-3 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 text-base ${
              formik.touched.password && formik.errors.password
                ? "ring-red-500"
                : ""
            }`}
          />
          {formik.touched.password && formik.errors.password ? (
            <div className="text-red-500 text-sm mt-1">
              {formik.errors.password}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-1">
        <div />
        <div className="text-sm leading-6">
          <Link
            to="/forgot-password"
            className="font-semibold text-purple-600 hover:text-purple-500"
          >
            Forgot Password
          </Link>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading || !formik.isValid}
          className={`flex w-full justify-center rounded-md px-4 py-3 text-base font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 ${
            loading || !formik.isValid
              ? "bg-purple-400 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-500 active:bg-purple-700"
          }`}
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </button>
      </div>

      <div className="flex items-center justify-center gap-1">
        <div className="flex items-center">
          <Link
            to="/register"
            className="block text-sm leading-6 text-gray-700 hover:underline cursor-pointer"
          >
            Don't have an account?
          </Link>
        </div>
        <div className="text-sm leading-6">
          <Link
            to="/register"
            className="font-semibold text-purple-600 hover:text-purple-500"
          >
            Register Now
          </Link>
        </div>
      </div>
    </form>
  );
});

LoginForm.displayName = "LoginForm";

export default function Login() {
  const { setUser, setTotalEarnings } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);

  useEffect(() => {
    // Reset login attempts after 30 minutes
    const timer = setTimeout(() => setLoginAttempts(0), 30 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [loginAttempts]);

  const handleSubmit = useCallback(
    async (values) => {
      if (loginAttempts >= 5) {
        toast.error("Too many login attempts. Please try again later.");
        return;
      }

      setLoading(true);
      try {
        const response = await axiosInstance.post("/users/login", values);
        const { token, user } = response.data;

        // Reset login attempts on successful login
        setLoginAttempts(0);

        // Batch state updates
        Promise.all([
          localStorage.setItem("authToken", token),
          localStorage.setItem("userId", user?._id),
        ]).then(() => {
          setTotalEarnings(user?.total_earnings);
          setUser(user);
          toast.success("Login Successful");
          // Use RAF for smoother navigation
          requestAnimationFrame(() => {
            setTimeout(() => navigate("/events"), 500);
          });
        });
      } catch (error) {
        console.error(error);
        setLoginAttempts(prev => prev + 1);
        
        // Provide more specific error messages
        if (error?.response?.status === 401) {
          toast.error("Invalid email or password");
        } else if (error?.response?.status === 403) {
          toast.error("Account is locked. Please reset your password");
        } else if (error?.code === 'ECONNABORTED') {
          toast.error("Connection timeout. Please check your internet connection");
        } else {
          toast.error(error?.response?.data?.message || "Login failed. Please try again");
        }
      } finally {
        setLoading(false);
      }
    },
    [setTotalEarnings, setUser, navigate, loginAttempts]
  );

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema,
    onSubmit: handleSubmit,
    validateOnMount: true,
    validateOnChange: true,
    validateOnBlur: true,
  });

  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Logo className="inline-block" to="/events" />
          <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
          <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
            <LoginForm formik={formik} loading={loading} />
          </div>
        </div>
      </div>
      
    </>
  );
}
