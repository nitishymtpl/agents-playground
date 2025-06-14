import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/button/Button";
import { LoadingSVG } from "@/components/button/LoadingSVG";
import { SettingsDropdown } from "@/components/playground/SettingsDropdown";
import { useConfig } from "@/hooks/useConfig";
import { ConnectionState } from "livekit-client";
import Link from "next/link";
import { ReactNode } from "react";

type PlaygroundHeaderProps = {
  logo?: ReactNode;
  title?: ReactNode;
  githubLink?: string;
  height: number;
  accentColor: string;
  connectionState: ConnectionState;
  onConnectClicked: () => void;
};

const planIdToName: { [key: string]: string } = {
  'plan_basic': "Basic Plan",
  'plan_pro': "Pro Plan",
  'plan_enterprise': "Enterprise Plan",
};

export const PlaygroundHeader = ({
  logo,
  title,
  githubLink,
  accentColor,
  height,
  onConnectClicked,
  connectionState,
}: PlaygroundHeaderProps) => {
  const { config } = useConfig();
  const { user, isSignedIn } = useUser();

  const subscriptionPlanId = user?.publicMetadata?.lemonSqueezyPlanId as string | undefined;
  const subscriptionStatus = user?.publicMetadata?.lemonSqueezyStatus as string | undefined;
  const creditsAvailable = user?.publicMetadata?.creditsAvailable as number | undefined;
  const customerPortalUrl = user?.publicMetadata?.lemonSqueezyCustomerPortalUrl as string | undefined;

  const planDisplayName = subscriptionPlanId ? (planIdToName[subscriptionPlanId] || subscriptionPlanId) : "Free Tier";
  const creditsDisplay = typeof creditsAvailable === 'number' ? creditsAvailable : 0;
  const statusDisplay = subscriptionStatus || "N/A";

  const isValidCustomerPortalUrl = customerPortalUrl && customerPortalUrl.startsWith('http');

  return (
    <div
      className={`flex flex-wrap gap-x-4 gap-y-2 pt-4 text-${accentColor}-500 justify-between items-center shrink-0`}
      style={{
        height: height + "px",
      }}
    >
      <div className="flex items-center gap-3 basis-full md:basis-auto order-1 md:order-1">
        <div className="flex">
          <a href="https://livekit.io">{logo ?? <LKLogo />}</a>
        </div>
        <div className="lg:text-center text-xs lg:text-base lg:font-semibold text-white truncate">
          {title}
        </div>
      </div>

      {/* Subscription Info Display - Placed to the left of action buttons */}
      {isSignedIn && (
        <div className="text-xs text-white/70 text-left order-3 md:order-2 flex-grow md:flex-grow-0">
          <div>Plan: <span className="font-semibold text-white">{planDisplayName}</span> (Status: <span className="font-semibold text-white">{statusDisplay}</span>)</div>
          <div>Credits: <span className="font-semibold text-white">{creditsDisplay}</span></div>
        </div>
      )}

      <div className="flex basis-full md:basis-auto justify-end items-center gap-2 order-2 md:order-3 ml-auto">
        {githubLink && (
          <a
            href={githubLink}
            target="_blank"
            className={`text-white hover:text-white/80`}
            title="GitHub Repository"
          >
            <GithubSVG />
          </a>
        )}
        <Link href="/pricing" className="text-white hover:text-white/80 text-sm font-medium py-1 px-2 rounded hover:bg-white/10" title="Pricing">
          Pricing
        </Link>
        {isValidCustomerPortalUrl && (
          <a
            href={customerPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white bg-sky-500 hover:bg-sky-600 text-sm font-medium py-1 px-2 rounded"
            title="Manage Subscription"
          >
            Manage Subscription
          </a>
        )}
        {config.settings.editable && <SettingsDropdown />}
        <UserButton afterSignOutUrl="/" />
        <Button
          accentColor={
            connectionState === ConnectionState.Connected ? "red" : accentColor
          }
          disabled={connectionState === ConnectionState.Connecting}
          onClick={() => {
            onConnectClicked();
          }}
        >
          {connectionState === ConnectionState.Connecting ? (
            <LoadingSVG />
          ) : connectionState === ConnectionState.Connected ? (
            "Disconnect"
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
};

// ... (LKLogo and GithubSVG components remain unchanged)
const LKLogo = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip0_101_119699)">
      <path
        d="M19.2006 12.7998H12.7996V19.2008H19.2006V12.7998Z"
        fill="currentColor"
      />
      <path
        d="M25.6014 6.40137H19.2004V12.8024H25.6014V6.40137Z"
        fill="currentColor"
      />
      <path
        d="M25.6014 19.2002H19.2004V25.6012H25.6014V19.2002Z"
        fill="currentColor"
      />
      <path d="M32 0H25.599V6.401H32V0Z" fill="currentColor" />
      <path d="M32 25.5986H25.599V31.9996H32V25.5986Z" fill="currentColor" />
      <path
        d="M6.401 25.599V19.2005V12.7995V6.401V0H0V6.401V12.7995V19.2005V25.599V32H6.401H12.7995H19.2005V25.599H12.7995H6.401Z"
        fill="white"
      />
    </g>
    <defs>
      <clipPath id="clip0_101_119699">
        <rect width="32" height="32" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

const GithubSVG = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 98 96"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      fill="currentColor"
    />
  </svg>
);
