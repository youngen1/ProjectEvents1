import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import TicketCard from "./TicketCard";
import NavBar from "../../components/NavBar";
import Footer from "../../components/Footer";

const MyTickets = () => {
  const [myTickets, setMyTickets] = useState([]);

  useEffect(() => {
    axiosInstance.get("/users/my-tickets").then((res) => {
      console.log("my-tickets", res?.data);
      setMyTickets(res?.data);
    });
  }, []);

  return (
    <div>
      <NavBar />
      <div className="py-24 bg-gray-100 min-h-screen ">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-6">
            <h2 className="text-2xl font-semibold">My Tickets</h2>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {myTickets?.map((ticket, index) => (
              <TicketCard key={ticket?._id} ticket={ticket} />
            ))}
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default MyTickets;
