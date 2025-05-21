import React, { useState, useCallback, memo, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast, Toaster } from "sonner";
import Footer from "../../components/Footer";
import axiosInstance from "../../utils/axiosInstance";
import { FaEye, FaEyeSlash } from "react-icons/fa";

// Memoize the validation schema
const validationSchema = Yup.object({
  newPassword: Yup.string()
    .min(8, "New password must be at least 8 characters")
    .required("New password is required")
    .notOneOf(
      [Yup.ref('oldPassword'), null],
      "New password must be different from the old password"
    ),
  confirmPassword: Yup.string()
    .required("Confirm password is required")
    .oneOf([Yup.ref('newPassword'), null], "Passwords must match"),
});

// Memoize the Form component
const ChangePassword2 = memo(({ formik, loading }) => {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const toggleNewPasswordVisibility = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          New Password
        </label>
        <div className="mt-2">
          <div className="relative">
            <input
              id="newPassword"
              name="newPassword"
              type={showNewPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              {...formik.getFieldProps("newPassword")}
              className={`block w-full rounded-md border-0 p-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 sm:text-sm sm:leading-6 ${formik.touched.newPassword && formik.errors.password
                ? "ring-red-500"
                : ""
                }`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={toggleNewPasswordVisibility}
            >
              {showNewPassword ? (
                <FaEyeSlash className="h-5 w-5 text-gray-400" />
              ) : (
                <FaEye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {formik.touched.newPassword && formik.errors.newPassword ? (
            <div className="text-red-500 text-sm mt-1">
              {formik.errors.newPassword}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Confirm Password
        </label>
        <div className="mt-2">
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              {...formik.getFieldProps("confirmPassword")}
              className={`block w-full rounded-md border-0 p-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 sm:text-sm sm:leading-6 ${formik.touched.confirmPassword && formik.errors.password
                ? "ring-red-500"
                : ""
                }`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={toggleConfirmPasswordVisibility}
            >
              {showConfirmPassword ? (
                <FaEyeSlash className="h-5 w-5 text-gray-400" />
              ) : (
                <FaEye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
            <div className="text-red-500 text-sm mt-1">
              {formik.errors.confirmPassword}
            </div>
          ) : null}
        </div>
      </div>


      <div>
        <button
          type="submit"
          className="flex w-full justify-center rounded-md bg-purple-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
        >
          {loading ? "Loading..." : "Change Password"}
        </button>
      </div>
    </form>
  );
});

ChangePassword.displayName = "ChangePassword";

export default function ChangePassword() {
  const { id } = useParams()
  const navigation = useNavigate()
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      // If id is found, save it to localStorage with the key 'token'
      localStorage.setItem("authToken", id);
    }
  }, [id]); // Only re-run the effect when 'id' changes
  const handleSubmit = useCallback(
    async (values) => {
      console.log('values: ', values);
      setLoading(true);
      let payload = {
        token: id,
        newPassword: values.newPassword,

      }
      try {
        const response = await axiosInstance.post("/users/reset-password", payload);
        if (response.status === 200) {
          toast.success(response.data.message)
          navigation('/')
        }


      } catch (error) {
        console.error(error);
        toast.error(error?.response?.data?.message || "Login failed");
      } finally {
        setLoading(false);
      }
    }, [])

  const formik = useFormik({
    initialValues: {
      newPassword: "",
      confirmPassword: "",
    },
    validationSchema,
    onSubmit: handleSubmit,
    validateOnMount: false,
    validateOnChange: false,
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
                Change your password
              </h2>
              <div className="mt-10">
                <ChangePassword2 formik={formik} loading={loading} />
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
