import React from "react";
import { AiOutlineClose } from "react-icons/ai"; // Importing the close icon
import { Link } from "react-router-dom";

const FollowersModel = ({ isOpen, onClose, followers }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[10000]">
      <div className="bg-white p-6 rounded-md shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Followers</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <AiOutlineClose size={24} />
          </button>
        </div>

        <ul className="max-h-60 overflow-y-auto divide-y divide-gray-200">
          {followers.map((follower) => (
            <li key={follower._id} className="py-4 flex items-center gap-x-2">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-x-2">
                  <img
                    src={follower.profile_picture}
                    alt={follower.fullname}
                    className="inline-block w-10 h-10 rounded-full object-cover object-center"
                  />
                  <span className="text-base">{follower.fullname}</span>
                </div>
                <Link
                  to={`/user-profile/${follower._id}`}
                  className="bg-purple-500 text-white px-4 flex items-center gap-x-2 py-1.5 rounded-md font-medium hover:bg-purple-600"
                >
                  View Profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FollowersModel;
