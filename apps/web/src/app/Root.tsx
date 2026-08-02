import { Suspense } from "react";
import { Outlet } from "react-router";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import { RouteFallback } from "./components/RouteFallback";

export default function Root() {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
        style={{ backgroundColor: "#0B1E3F", color: "#FFFFFF", outline: "2px solid #C9A24B" }}
      >
        Skip to content
      </a>
      <Nav />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Suspense fallback={<RouteFallback rows={6} />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
