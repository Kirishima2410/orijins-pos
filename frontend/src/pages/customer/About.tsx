import React from 'react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-brown-900 sm:text-5xl">
          About Us
        </h1>
        <p className="mt-4 text-xl text-gray-600">
          Discover the story behind our passion for exceptional coffee and service.
        </p>
      </div>

      <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
        <div className="p-8 sm:p-12">
          <div className="prose prose-brown max-w-none text-gray-600">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
            <p className="mb-6">
              Welcome to Orijins, where every cup tells a story. Born out of a deep passion for specialty coffee and community gathering, we set out to create more than just a cafe – we wanted to build a sanctuary for coffee lovers and a welcoming space for everyone.
            </p>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-8">Our Mission</h2>
            <p className="mb-6">
              Our mission is simple: to serve extraordinary coffee while fostering meaningful connections. We source our beans ethically from the finest coffee-growing regions around the world, ensuring that every farmer receives fair compensation for their hard work.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-8">Quality First</h2>
            <p className="mb-6">
              From the careful selection of our beans to the precise calibration of our espresso machines, we obsessed over every detail. Our skilled baristas are trained to extract the perfect flavors, bringing out the unique characteristics of each roast.
            </p>
            
            <div className="mt-10 bg-brown-50 p-6 rounded-xl border border-brown-100">
              <h3 className="text-lg font-semibold text-brown-800 mb-2">Join Our Journey</h3>
              <p className="text-brown-600">
                Whether you're stopping by for your morning commute or settling in for a lazy afternoon, we're thrilled to be part of your daily ritual. Thank you for choosing Orijins.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
