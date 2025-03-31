"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useFormik } from "formik";
import { useAuth } from "../../context/AuthContext";

export default function WithdrawModel({ open, setOpen }) {
  const { requestWithdrawal } = useAuth();

  const formik = useFormik({
    initialValues: {
      card_number: "",
      card_expiry_month: "",
      card_expiry_year: "",
      card_cvv: "",
    
    },
    onSubmit: async (values) => {
      const cardDetails = {
        card_number: values.card_number,
        card_expiry_month: values.card_expiry_month,
        card_expiry_year: values.card_expiry_year,
        card_cvv: values.card_cvv,
      };
      try {
        await requestWithdrawal(cardDetails);
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
                Request Withdrawal
              </DialogTitle>
              <div className="mt-4">
                <div className="mb-4">
                  <label
                    htmlFor="card_number"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Card Number
                  </label>
                  <input
                    type="text"
                    name="card_number"
                    id="card_number"
                    value={formik.values.card_number}
                    onChange={formik.handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="card_expiry_month"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Expiry Month
                  </label>
                  <input
                    type="text"
                    name="card_expiry_month"
                    id="card_expiry_month"
                    value={formik.values.card_expiry_month}
                    onChange={formik.handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="card_expiry_year"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Expiry Year
                  </label>
                  <input
                    type="text"
                    name="card_expiry_year"
                    id="card_expiry_year"
                    value={formik.values.card_expiry_year}
                    onChange={formik.handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="card_cvv"
                    className="block text-sm font-medium text-gray-700"
                  >
                    CVV
                  </label>
                  <input
                    type="text"
                    name="card_cvv"
                    id="card_cvv"
                    value={formik.values.card_cvv}
                    onChange={formik.handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-6">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Withdraw
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
