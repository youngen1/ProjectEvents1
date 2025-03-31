import React, { useRef, useState } from "react";
import QRCode from "qrcode.react";
import {
  PDFDownloadLink,
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { toPng } from "html-to-image";
import moment from "moment";
import { Link } from "react-router-dom";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";

const TicketCard = ({ ticket }) => {
  const {
    additional_info,
    category,
    event_address,
    event_date_and_time,
    event_description,
    event_max_capacity,
    event_title,
    age_restriction,
    gender_restriction,
    event_video,
    event_duration,
    created_by, // Host information: profile picture, name, and email
  } = ticket;

  const qrCodeRef = useRef(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const generateQrCodeUrl = async () => {
    if (qrCodeRef.current) {
      const dataUrl = await toPng(qrCodeRef.current);
      setQrCodeUrl(dataUrl);
    }
  };

  const styles = StyleSheet.create({
    page: {
      padding: 20,
    },
    section: {
      margin: 10,
      padding: 10,
      flexGrow: 1,
    },
    qrCode: {
      margin: "20px auto",
    },
    qrImage: {
      width: 128,
      height: 128,
      margin: "20px auto",
    },
  });

  const TicketPDF = () => (
    <Document>
      <Page style={styles.page}>
        <View style={styles.section}>
          {/* Hosted By Section */}
          <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
            Hosted by:
          </Text>
          <View style={{ marginBottom: 10 }}>
            {created_by?.profile_picture && (
              <Image
                src={created_by.profile_picture}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  marginBottom: 10,
                }}
              />
            )}
            <Text>{created_by?.fullname}</Text>
            <Text>{created_by?.email}</Text>
          </View>
          {/* Event Details */}
          <Text>Event Title: {event_title}</Text>
          <Text>
            Event Date and Time:{" "}
            {new Date(event_date_and_time).toLocaleString()}
          </Text>
          <Text>Event Address: {event_address?.address}</Text>
          <Text>Category: {category}</Text>
          <Text>Description: {event_description}</Text>
          <Text>Max Capacity: {event_max_capacity}</Text>
          <Text>Additional Info: {additional_info || "N/A"}</Text>
          <Text>
            Age Restriction:{" "}
            {age_restriction?.length > 0 ? age_restriction.join(", ") : "None"}
          </Text>
          <Text>
            Gender Restriction:{" "}
            {gender_restriction?.length > 0
              ? gender_restriction.join(", ")
              : "None"}
          </Text>
        </View>
        {qrCodeUrl && <Image style={styles.qrImage} src={qrCodeUrl} />}
      </Page>
    </Document>
  );

  const videoOptions = {
    controls: [
      "play-large",
      "play",
      "progress",
      "current-time",
      "mute",
      "volume",
      "fullscreen",
    ],
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-md mx-auto">
      {/* Hosted By Section */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Hosted by:</h3>
        <div className="flex items-center space-x-2">
          {created_by?.profile_picture && (
            <Link to={`/user-profile/${created_by?._id}`}>
              <img
                src={created_by.profile_picture}
                alt="Host Profile"
                className="w-12 h-12 rounded-full"
              />
            </Link>
          )}
          <div className="flex flex-col">
            <span className="font-bold">{created_by?.fullname}</span>
            <span className="text-xs text-gray-500">{created_by?.email}</span>
          </div>
        </div>
      </div>

      {/* Event Video */}
      {event_video && (
        <div className="mb-4">
          <div className="aspect-w-16 aspect-h-9">
            <Plyr
              source={{
                type: "video",
                sources: [{ src: event_video, type: "video/mp4" }],
              }}
              options={videoOptions}
            />
          </div>
        </div>
      )}

      {/* Event Details */}
      <h2 className="text-xl font-bold mb-4">{event_title}</h2>
      <p className="mb-2">
        <strong>Event Date and Time:</strong>{" "}
        {moment(event_date_and_time).format("DD MMM YYYY HH:mm")}
      </p>
      <p className="mb-2">
        <strong>Duration:</strong>{" "}
        {event_duration} {event_duration === 1 ? 'hour' : 'hours'}
      </p>
      <p className="mb-2">
        <strong>Event Address:</strong> {event_address?.address}
      </p>
      <p className="mb-2">
        <strong>Category:</strong> {category}
      </p>
      <p className="mb-2">
        <strong>Description:</strong> {event_description}
      </p>
      <p className="mb-2">
        <strong>Max Capacity:</strong> {event_max_capacity}
      </p>
      <p className="mb-2">
        <strong>Additional Info:</strong> {additional_info || "N/A"}
      </p>
      <p className="mb-2">
        <strong>Age Restriction:</strong>{" "}
        {age_restriction?.length > 0 ? age_restriction.join(", ") : "None"}
      </p>
      <p className="mb-2">
        <strong>Gender Restriction:</strong>{" "}
        {gender_restriction?.length > 0
          ? gender_restriction.join(", ")
          : "None"}
      </p>

      {/* QR Code */}
      <div ref={qrCodeRef} className="flex justify-center my-4">
        <QRCode value={`Event: ${event_title}`} size={128} />
      </div>

      {/* Generate PDF Button */}
      <button
        onClick={generateQrCodeUrl}
        className="bg-blue-500 text-white py-2 px-4 rounded"
      >
        Generate PDF
      </button>

      {/* PDF Download Link */}
      {qrCodeUrl && (
        <PDFDownloadLink
          document={<TicketPDF />}
          fileName={`${event_title}_ticket.pdf`}
        >
          {({ loading }) =>
            loading ? "Loading document..." : "Download Ticket as PDF"
          }
        </PDFDownloadLink>
      )}
    </div>
  );
};

export default TicketCard;
