import React, { useState } from "react";
import {
  Dialog,
  DialogPanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import Logo from "./Logo";

const NavBar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, token, logout } = useAuth();

  const navigate = useNavigate();

  const navigation = [
    { name: "Events", href: "/events" },
    { name: "About Us", href: "/about-us" },
    { name: "Contact", href: "/contact" },
    ...(user?.isAdmin ? [{ name: "Platform Earnings", href: "/admin/earnings" }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    toast.success("Logout successful");
  };

  return (
    <>
      <Toaster richColors />
      <header className="absolute inset-x-0 top-0 z-50 ">
        <nav
          aria-label="Global"
          className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8"
        >
          <div className="lg:flex lg:flex-1 hidden">
            <Logo to="/events" />
          </div>
          {user ? (
            <div className="lg:hidden flex items-center justify-center">
              <Menu as="div" className="relative">
                <div>
                  <MenuButton className="relative flex rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                    <span className="absolute -inset-1.5" />
                    <span className="sr-only">Open user menu</span>
                    <img
                      alt=""
                      src={user?.profile_picture || ""}
                      className="h-8 w-8 rounded-full object-cover object-center"
                    />
                  </MenuButton>
                </div>
                <MenuItems
                  transition
                  className="absolute left-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none"
                >
                  <MenuItem as="div">
                    <Link
                      to="/show-profile"
                      className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100"
                    >
                      Your Profile
                    </Link>
                  </MenuItem>
                  <MenuItem as="div">
                    <Link
                      to="/my-tickets"
                      className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100"
                    >
                      My Tickets
                    </Link>
                  </MenuItem>
                  <MenuItem as="div">
                    <Link
                      to="/withdrawal-history"
                      className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100"
                    >
                      Finance
                    </Link>
                  </MenuItem>
                  <MenuItem as="div">
                    <Link
                      to="/change-password"
                      className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100"
                    >
                      Change Password
                    </Link>
                  </MenuItem>
                  <MenuItem as="div">
                    {localStorage.getItem("authToken") !== "" && (
                      <span
                        onClick={handleLogout}
                        className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100"
                      >
                        Log out
                      </span>
                    )}
                  </MenuItem>
                </MenuItems>
              </Menu>
              <div className="pl-1.5">
                <span className="text-sm text-gray-700 font-medium">
                  {user?.fullname}
                </span>
                <span className="text-xs text-gray-500 block">
                  {user?.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 lg:hidden">
              <Logo to="/events" />
            </div>
          )}
          <div className="flex lg:hidden items-center gap-x-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700"
            >
              <span className="sr-only">Open main menu</span>
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <div className="hidden lg:flex lg:gap-x-12 ">
            {navigation?.map((item) => (
              <Link
                key={item?.name}
                to={item?.href}
                className="text-sm font-semibold leading-6 text-gray-900"
              >
                {item?.name}
              </Link>
            ))}
          </div>
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            {user ? (
              <div className="flex items-center justify-center">
                <Menu as="div" className="relative">
                  <div>
                    <MenuButton className="relative flex rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                      <span className="absolute -inset-1.5" />
                      <span className="sr-only">Open user menu</span>
                      <img
                        alt=""
                        src={user?.profile_picture || ""}
                        className="h-8 w-8 rounded-full object-cover object-center"
                      />
                    </MenuButton>
                  </div>
                  <MenuItems
                    transition
                    className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none"
                  >
                    <MenuItem as="div">
                      <Link
                        to="/show-profile"
                        className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 cursor-pointer"
                      >
                        Your Profile
                      </Link>
                    </MenuItem>
                    <MenuItem as="div">
                      <Link
                        to="/my-tickets"
                        className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 cursor-pointer"
                      >
                        My Tickets
                      </Link>
                    </MenuItem>
                    <MenuItem as="div">
                    <Link
                      to="/withdrawal-history"
                      className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100"
                    >
                      Finance
                    </Link>
                  </MenuItem>
                    <MenuItem as="div">
                      <Link
                        to="/change-password"
                        className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 cursor-pointer"
                      >
                        Change Password
                      </Link>
                    </MenuItem>
                    <MenuItem as="div">
                      {localStorage.getItem("authToken") !== "" && (
                        <span
                          onClick={handleLogout}
                          className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 cursor-pointer"
                        >
                          Log out
                        </span>
                      )}
                    </MenuItem>
                  </MenuItems>
                </Menu>
                <div className="pl-1.5">
                  <span className="text-sm text-gray-700 font-medium">
                    {user?.fullname}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {user?.role}
                  </span>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                className="text-sm font-semibold leading-6 text-gray-900"
              >
                Log in <span aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        </nav>
        <Dialog
          open={mobileMenuOpen}
          onClose={setMobileMenuOpen}
          className="lg:hidden"
        >
          <div className="" />
          <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
            <div className="flex items-center justify-between">
              <Logo to="/events" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 rounded-md p-2.5 text-gray-700"
              >
                <span className="sr-only">Close menu</span>
                <XMarkIcon aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-2 py-6">
                  {navigation?.map((item) => (
                    <Link
                      key={item?.name}
                      to={item?.href}
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    >
                      {item?.name}
                    </Link>
                  ))}
                </div>
                <div className="py-6">
                  {!user && (
                    <Link
                      to="/login"
                      className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    >
                      Log in
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </DialogPanel>
        </Dialog>
      </header>
    </>
  );
};

export default NavBar;
