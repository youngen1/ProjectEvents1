"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useFormik } from "formik";
import { useAuth } from "../../context/AuthContext";

export default function UpdateProfileModel({ open, setOpen }) {
  const { user, updateProfile } = useAuth();

  useEffect(() => {
    if (user) {
      formik.setValues({
        fullname: user?.fullname,
        phone_number: user?.phone_number,
        username: user?.username || '',
      });
    }
  }, [user]);

  const formik = useFormik({
    initialValues: {},
    onSubmit: async (values) => {
      const json = {
        fullname: values.fullname,
        phone_number: values.phone_number,
        username: values.username,
      };
      try {
        await updateProfile(json);
        setOpen(false);
      } catch (error) {
        console.error(error.message);
      }
    },
  });

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      className="relative z-10"
    >
      <DialogBackdrop className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />

      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto">
        <DialogPanel className="relative sm:mx-auto transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left mx-6 shadow-xl w-full transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
          <form onSubmit={formik.handleSubmit}>
            <div>
              <DialogTitle
                as="h3"
                className="text-base font-semibold leading-6 text-gray-900"
              >
                Update Profile
              </DialogTitle>
              <div className="mt-4">
                <div className="mb-4">
                  <label
                    htmlFor="fullname"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullname"
                    id="fullname"
                    value={formik.values.fullname}
                    onChange={formik.handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="phone_number"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone_number"
                    id="phone_number"
                    value={formik.values.phone_number}
                    onChange={formik.handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Username
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      name="username"
                      id="username"
                      value={formik.values.username}
                      onChange={formik.handleChange}
                      placeholder="username"
                      className="block w-full rounded-none rounded-r-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Only letters, numbers and underscores allowed
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-6">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Save
              </button>
              <button
                type="button"
                className="inline-flex w-full justify-center mt-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
