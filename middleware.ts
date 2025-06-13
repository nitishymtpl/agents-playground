import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Ensure that routes like /api/token are protected
  // Add any public routes to this array.
  // By default, all routes are protected and this specifies exceptions.
  publicRoutes: [
    "/sign-in(.*)",
    "/sign-up(.*)",
    // Add other public routes here if needed, e.g., marketing pages
    // "/", // If you want the home page to be public before sign-in
  ],
});

export const config = {
  matcher: ['/((?!.+\.[\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
