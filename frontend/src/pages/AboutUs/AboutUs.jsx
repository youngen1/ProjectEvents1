import React from 'react';
import Logo from '../../components/Logo';

const AboutUs = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-100"> {/* Slightly softer background */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center"> {/* Wider container */}
        <Logo className="inline-block" to="/events" />
        <h1 className="mt-6 text-3xl font-extrabold leading-9 tracking-tight text-gray-900"> {/* Larger, bolder heading */}
          TrueCircleEvents
        </h1>
        <p className="mt-4 text-lg text-gray-700"> {/* Subheading */}
          Connecting Hosts and Attendees for Unforgettable Experiences
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-3xl"> {/* Wider container for content */}
        <div className="bg-white px-6 py-12 shadow sm:rounded-lg sm:px-12 prose lg:prose-xl"> {/* Added prose class for better typography */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
            <p className="text-base leading-7 text-gray-700">
            TrueCircleEvents was founded in 2024 with a simple yet powerful vision: to create a platform that seamlessly connects event hosts and attendees, fostering vibrant communities and unforgettable experiences.  We recognized the need for a user-friendly platform that empowers hosts to easily manage and promote their events while providing attendees with a streamlined way to discover and participate in exciting happenings.
            </p>
            <p className="mt-4 text-base leading-7 text-gray-700">
              From our humble beginnings, we have grown into a thriving community of event organizers and enthusiasts. We are driven by a passion for innovation and a commitment to providing exceptional service.  We believe that events are the lifeblood of communities, and we are dedicated to making them more accessible and enjoyable for everyone.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-base leading-7 text-gray-700">
              Our mission is to empower event hosts and enrich the lives of attendees by providing a cutting-edge platform that simplifies event management and facilitates meaningful connections. We strive to be the go-to destination for discovering and experiencing the best events in [Location/Region/World].
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Values</h2>
            <ul className="list-disc pl-6 text-base leading-7 text-gray-700">
              <li><strong>User-centricity:</strong> We prioritize the needs and experiences of our users in everything we do.</li>
              <li><strong>Innovation:</strong> We are constantly seeking new ways to improve our platform and enhance the event experience.</li>
              <li><strong>Community:</strong> We believe in the power of events to bring people together and build strong communities.</li>
              <li><strong>Excellence:</strong> We are committed to providing exceptional service and a high-quality platform.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Team</h2>
            <p className="text-base leading-7 text-gray-700">
              We are a team of passionate individuals with diverse backgrounds and a shared commitment to creating a world-class event platform.  
            </p>
          </section>

          {/* Add more sections as needed (e.g., Contact Us, FAQs) */}
        </div>
      </div>
      <footer className="text-center mt-8">
        TrueCircleEvents Pty (LTD) 2025
      </footer>
    </div>
  );
};

export default AboutUs;