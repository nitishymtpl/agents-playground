import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Add public routes here
  // For example, if you have a landing page at /landing, you would add "/landing" to the array.
  publicRoutes: [],
});

export const config = {
  matcher: ['/((?!.+\.[\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
