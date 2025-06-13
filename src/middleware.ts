import { clerkMiddleware, createRouteMatcher, getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// Define routes that are public (no auth required)
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Add any other public routes here, e.g., marketing pages, legal docs
  // '/', // if your homepage is public
]);

// Define routes that require an active subscription
const isProtectedContentRoute = createRouteMatcher([
  '/premium-content(.*)',
  // Add other subscription-protected routes here
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, sessionClaims, orgId, orgRole, orgSlug } = auth();

  // If the route is public, allow access
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // If the user is not authenticated, redirect to sign-in
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Handle protected content routes
  if (isProtectedContentRoute(req)) {
    // We need to fetch full user metadata which might not be on sessionClaims by default.
    // Note: Direct access to sessionClaims.publicMetadata might work if you configure Clerk JWT templates.
    // For a more robust way, especially if metadata is large or sensitive for JWT, fetch it.
    // However, for simplicity in this step, we'll assume it *could* be on sessionClaims or try a direct fetch.
    // In a real app, consider JWT template customization for frequently accessed small metadata.

    let hasActiveSubscription = false;
    // Attempt to get from sessionClaims first (if configured in Clerk JWT template)
    if (sessionClaims?.publicMetadata) {
        const metadata = sessionClaims.publicMetadata as { lemonSqueezySubscriptionStatus?: string };
        if (metadata.lemonSqueezySubscriptionStatus === 'active') {
            hasActiveSubscription = true;
        }
    }

    // If not found or not active on sessionClaims, and for a more reliable check, fetch user data.
    // This adds latency but is more reliable if JWT templates aren't customized.
    // For this example, let's rely on fetching if not readily available on claims.
    // This is a simplified example; in production, you'd optimize this.
    if (!hasActiveSubscription && userId) {
        try {
            // Note: clerkClient is not directly available in middleware like this in Next.js Edge runtime.
            // auth() itself should provide the necessary claims if JWT is customized.
            // If running in Node.js runtime (default for non-Edge API routes), you could potentially use clerkClient.
            // For middleware, the primary way is to customize the JWT session token.
            // The below is illustrative and might not work in Edge middleware without JWT customization.
            // For now, we'll proceed assuming sessionClaims *could* have it or this is a conceptual step.
            // A common pattern is that if metadata is critical for routing, it *is* added to JWT.

            // SIMPLIFICATION: Assume for now `sessionClaims.publicMetadata` is populated by Clerk settings.
            // If `sessionClaims.publicMetadata.lemonSqueezySubscriptionStatus` is not 'active', deny access.
            // This is the most common and recommended way for middleware.
             if (!sessionClaims?.publicMetadata?.lemonSqueezySubscriptionStatus || sessionClaims.publicMetadata.lemonSqueezySubscriptionStatus !== 'active') {
                const pricingUrl = new URL('/pricing', req.url); // Or '/profile' or a specific "no access" page
                pricingUrl.searchParams.set('reason', 'no_active_subscription');
                return NextResponse.redirect(pricingUrl);
             }
             // If we reached here and it was 'active' from claims, allow.
             if (sessionClaims?.publicMetadata?.lemonSqueezySubscriptionStatus === 'active') {
                hasActiveSubscription = true; // Confirm again
             } else {
                // Fallback if somehow logic is convoluted, deny.
                const pricingUrl = new URL('/pricing', req.url);
                pricingUrl.searchParams.set('reason', 'subscription_check_failed');
                return NextResponse.redirect(pricingUrl);
             }

        } catch (error) {
            console.error("Middleware: Error fetching user for subscription check:", error);
            // Fallback: redirect to pricing or an error page
            const errorUrl = new URL('/pricing', req.url); // Or an error page
            errorUrl.searchParams.set('reason', 'middleware_error');
            return NextResponse.redirect(errorUrl);
        }
    }


    if (!hasActiveSubscription) {
         const pricingUrl = new URL('/pricing', req.url);
         pricingUrl.searchParams.set('reason', 'no_active_subscription_final_check');
         return NextResponse.redirect(pricingUrl);
    }
  }

  // For any other authenticated routes that are not public and not specially protected, allow access
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes (although subscription checks for APIs might be better done within the API handler)
    // '/(api|trpc)(.*)', // Commenting out for now to focus on page protection
  ],
};
