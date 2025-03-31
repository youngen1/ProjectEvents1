import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { useEffect } from "react";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const { id } = useParams();


  const verifyEmails = async () => {
    const payload = { token: id };

    try {
      // Make the POST request to verify the user
      const response = await axiosInstance.post('/users/verify-user', payload);
      console.log(response);
      if (response.status ===200) {
        navigate('/');
      }
    } catch (error) {
      // Catch and handle any errors
      console.error('Verification failed: ', error.response?.data?.message || error.message);
      // You can show an alert or handle the error differently based on your app's needs
      // navigate('/error');  // Optionally, navigate to an error page
    }
  };
  useEffect(() => {
    if (!id) return


    verifyEmails();
  }, [id]);

  return <div>Verifying your email...</div>;
};

export default VerifyEmail;