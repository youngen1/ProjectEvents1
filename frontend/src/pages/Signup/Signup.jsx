import React, { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Link, useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { DatePicker } from "rsuite";
import "rsuite/dist/rsuite.min.css";
import { storage } from "../../utils/firebaseConfig";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useAuth } from "../../context/AuthContext";
import Footer from "../../components/Footer";
import Logo from "../../components/Logo";
import axiosInstance from "../../utils/axiosInstance";

export default function Signup() {
  const { register } = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullname: '',
    username: '',
    email: '',
    password: '',
    dateOfBirth: '',
    phone_number: '',
    gender: '',
    profile_picture: '',
  });

  const formik = useFormik({
    initialValues: {
      fullname: "",
      username: "",
      phone_number: "",
      email: "",
      password: "",
      gender: "",
    },
    validationSchema: Yup.object({
      fullname: Yup.string().required("Full name is required"),
      username: Yup.string()
        .matches(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed")
        .required("Username is required"),
      phone_number: Yup.string().required("Phone number is required"),
      email: Yup.string()
        .email("Invalid email address")
        .required("Email is required"),
      password: Yup.string()
        .min(8, "Password must be at least 8 characters")
        .required("Password is required"),
      gender: Yup.string()
        .oneOf(["male", "female", "other"], "Please select a valid gender")
        .required("Gender is required"),
    }),
    onSubmit: async (values) => {
      setIsUploading(true);
      try {
        // Check if profile picture is selected
        if (!profilePicture) {
          toast.error("Please select a profile picture");
          setIsUploading(false);
          return;
        }

        const profilePictureURL = await uploadImage(
          profilePicture,
          "profilePicture"
        );

        const registrationData = {
          ...values,
          dateOfBirth: dateOfBirth
            ? dateOfBirth.toISOString().split("T")[0]
            : null,
          profile_picture: profilePictureURL,
        };

        await axiosInstance
          .post("/users/register", registrationData)
          .then((res) => {
            console.log(res);
            toast.success("Registration successful");
            setTimeout(() => {
              navigate("/login");
            }, 1000);
          });
      } catch (error) {
        console.error("Error during registration:", error);
        if (error.response && error.response.data.message === "Email already exists") {
          toast.error("Email already registered");
        } else {
          toast.error("Try Again! Registration failed");
        }
      } finally {
        formik.resetForm();
        setIsUploading(false);
      }
    },
  });

  const handleFileChange = (e, setImage) => {
    setImage(e.target.files[0]);
  };

  const uploadImage = (file, folder) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const storageRef = ref(storage, `${folder}/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Progress function (optional)
        },
        (error) => {
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
        }
      );
    });
  };

  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Logo className="inline-block" to="/events" />
          <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            Create your account
          </h2>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
          <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12">
            <form onSubmit={formik.handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="profile_picture"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Profile Picture
                </label>
                <div className="mt-2">
                  <input
                    id="profile_picture"
                    name="profile_picture"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setProfilePicture)}
                    className="block w-full text-sm text-gray-900 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="fullname"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Full Name
                </label>
                <div className="mt-2">
                  <input
                    id="fullname"
                    name="fullname"
                    type="text"
                    required
                    {...formik.getFieldProps("fullname")}
                    className={`block w-full rounded-md border-0 px-4 py-3 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 text-base ${
                      formik.touched.fullname && formik.errors.fullname
                        ? "ring-red-500"
                        : ""
                    }`}
                  />
                  {formik.touched.fullname && formik.errors.fullname ? (
                    <div className="text-red-500 text-sm mt-1">
                      {formik.errors.fullname}
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <label
                  htmlFor="dateOfBirth"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Date of Birth
                </label>
                <div className="mt-2">
                  <DatePicker
                    value={dateOfBirth}
                    onChange={(date) => setDateOfBirth(date)}
                    oneTap
                    placeholder="Select Date"
                    block
                    format="MM/dd/yyyy"
                    className="w-full text-base"
                    style={{ height: '48px' }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="gender"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Gender
                </label>
                <div className="mt-2">
                  <select
                    id="gender"
                    name="gender"
                    required
                    {...formik.getFieldProps("gender")}
                    className={`block w-full rounded-md border-0 px-4 py-3 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-purple-600 text-base ${
                      formik.touched.gender && formik.errors.gender
                        ? "ring-red-500"
                        : ""
                    }`}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {formik.touched.gender && formik.errors.gender ? (
                    <div className="text-red-500 text-sm mt-1">
                      {formik.errors.gender}
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone_number"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Phone Number
                </label>
                <div className="mt-2">
                  <input
                    id="phone_number"
                    name="phone_number"
                    type="tel"
                    inputMode="tel"
                    required
                    {...formik.getFieldProps("phone_number")}
                    className={`block w-full rounded-md border-0 px-4 py-3 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 text-base ${
                      formik.touched.phone_number && formik.errors.phone_number
                        ? "ring-red-500"
                        : ""
                    }`}
                  />
                  {formik.touched.phone_number && formik.errors.phone_number ? (
                    <div className="text-red-500 text-sm mt-1">
                      {formik.errors.phone_number}
                    </div>
                  ) : null}
                </div>
              </div>

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
                    autoComplete="email"
                    required
                    {...formik.getFieldProps("email")}
                    className={`block w-full rounded-md border-0 px-4 py-3 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-600 text-base ${
                      formik.touched.email && formik.errors.email
                        ? "ring-red-500"
                        : ""
                    }`}
                  />
                  {formik.touched.email && formik.errors.email ? (
                    <div className="text-red-500 text-sm mt-1">
                      {formik.errors.email}
                    </div>
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
                    autoComplete="new-password"
                    required
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

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  {...formik.getFieldProps("username")}
                  className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                    formik.touched.username && formik.errors.username ? "border-red-500" : ""
                  }`}
                  placeholder="Choose a username"
                />
                {formik.touched.username && formik.errors.username ? (
                  <div className="text-red-500 text-sm mt-1">
                    {formik.errors.username}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Only letters, numbers, and underscores allowed
                  </p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isUploading}
                  className={`flex w-full justify-center rounded-md px-4 py-3 text-base font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 ${
                    isUploading
                      ? "bg-purple-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-500 active:bg-purple-700"
                  }`}
                >
                  {isUploading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    "Create account"
                  )}
                </button>
              </div>

              <div className="text-sm text-center">
                <Link
                  to="/login"
                  className="font-semibold text-purple-600 hover:text-purple-500"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
      
    </>
  );
}