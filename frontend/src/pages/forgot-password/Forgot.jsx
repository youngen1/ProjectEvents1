import React, { useState, useCallback, memo } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast, Toaster } from "sonner";
import Footer from "../../components/Footer";
import axiosInstance from "../../utils/axiosInstance";

// Memoize the validation schema
const validationSchema = Yup.object({
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
});

// Memoize the Form component
const ForgotForm = memo(({ formik, loading }) => (
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
          required
          autoComplete="email"
          {...formik.getFieldProps("email")}
          className={`block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 sm:text-sm sm:leading-6 ${formik.touched.email && formik.errors.email ? "ring-red-500" : ""
            }`}
        />
        {formik.touched.email && formik.errors.email ? (
          <div className="text-red-500 text-sm mt-1">{formik.errors.email}</div>
        ) : null}
      </div>
    </div>

    <div>
      <button
        type="submit"
        className="flex w-full justify-center rounded-md bg-purple-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
      >
        {loading ? "Loading..." : "Send Email"}
      </button>
    </div>
  </form>
));

Forgot.displayName = "Forgot";

export default function Forgot() {
  const { setUser, setTotalEarnings } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);


  const handleSubmit = useCallback(
    async (values) => {
      console.log('values: ', values);
      setLoading(true);
      try {
        const response = await axiosInstance.post("/users/forgot-password/", values);
        console.log('response: ', response);
        if (response.status === 200) {
          toast.success(response.data.message)
        }

        // Batch state updates

      } catch (error) {
        console.error(error);
        toast.error(error?.response?.data?.message || "Login failed");
      } finally {
        setLoading(false);
      }
    }, [])

  const formik = useFormik({
    initialValues: {
      email: "",
    },
    validationSchema,
    onSubmit: handleSubmit,
    validateOnMount: false, // Prevent initial validation
    validateOnChange: false, // Validate only on blur
    validateOnBlur: true,
  });

  return (
    <>
      <Toaster richColors />
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full">
          <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
            <div className="mx-auto w-full max-w-sm lg:w-96">
              <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-gray-900">
                Enter your email to confirm your account.
              </h2>
              <div className="mt-10">
                <ForgotForm formik={formik} loading={loading} />
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </>
  );
}
