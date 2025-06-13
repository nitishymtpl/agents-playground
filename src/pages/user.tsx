import { NextPage } from 'next';
import { UserProfile } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

const UserProfilePage: NextPage = () => {
  // The UserProfile component needs to be mounted client-side to have access to navigation
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)', padding: '20px' }}>
      {isMounted ? (
        <UserProfile
          path="/user" // The path to the user profile page
          routing="path" // Use path-based routing
          appearance={{
            elements: {
              card: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '8px' },
              pageScrollBox: { paddingTop: '20px', paddingBottom: '20px'},
            }
          }}
        >
          {/* You can add custom links or sections to the UserProfile component here if needed */}
          {/* For example, adding a link back to the main app or a specific section */}
          {/* <UserProfile.Link label="Go to Dashboard" url="/dashboard" /> */}
        </UserProfile>
      ) : (
        <div>Loading profile...</div> // Or a loading spinner
      )}
    </div>
  );
};

export default UserProfilePage;
