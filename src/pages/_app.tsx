import { ClerkProvider } from "@clerk/nextjs";
import { CloudProvider } from "@/cloud/useCloud";
import "@livekit/components-styles/components/participant";
import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider {...pageProps}>
      <CloudProvider>
        <Component {...pageProps} />
      </CloudProvider>
    </ClerkProvider>
  );
}
