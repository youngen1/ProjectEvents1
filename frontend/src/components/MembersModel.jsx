import React from "react";
import { AiOutlineClose } from "react-icons/ai"; // Importing the close icon

const MembersModel = ({ isOpen, onClose, members }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[10000]">
      <div className="bg-white p-6 rounded-md shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Members Joined</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <AiOutlineClose size={24} /> 
          </button>
        </div>

        <ul className="max-h-60 overflow-y-auto divide-y divide-gray-200">
          {members?.map((member) => (
            <li key={member._id} className="py-4 flex items-center gap-x-2">
              <img
                src={member.profile_picture}
                alt={member.fullname}
                className="inline-block w-10 h-10 rounded-full object-cover object-center"
              />
              <span className="text-base">{member.fullname}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MembersModel;
