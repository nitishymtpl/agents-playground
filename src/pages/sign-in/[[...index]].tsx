import { SignIn } from "@clerk/nextjs";

const SignInPage = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
  </div>
);
export default SignInPage;
