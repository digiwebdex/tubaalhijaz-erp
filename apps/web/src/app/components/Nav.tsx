import { useEffect } from "react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X, Globe } from "lucide-react";
import { useLang } from "../lib/LangContext";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
// Light-ink variant: transparent background, cream calligraphy, gold wordmark —
// built for dark surfaces. Replaces the old JPEG, which had an opaque white
// field that had to be hidden with `filter: brightness(0) invert(1)` — that
// filter whitened the background too and rendered the logo as a solid white box.
import logoImg from "@/assets/logo-light.png";

const NAVY = "#0F1326";
const INK  = "#E2E8F5";
const GOLD = "#C8943A";

const links = [
  { to: "/", label: "Home", bn: "হোম" },
  { to: "/services", label: "Services", bn: "সেবাসমূহ" },
  { to: "/about", label: "About Us", bn: "আমাদের সম্পর্কে" },
  { to: "/contact", label: "Contact", bn: "যোগাযোগ" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, toggleLang } = useLang();
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || !isHome || mobileOpen;

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: solid ? "#0F1326" : "transparent",
          boxShadow: solid ? "0 1px 0 rgba(226,232,245,0.38)" : "none",
          backdropFilter: solid ? "none" : "blur(0)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center gap-8">
          <Link to="/" className="flex items-center shrink-0">
            <ImageWithFallback
              src={logoImg}
              alt="TUBA ALHIJAZ"
              className="h-9 w-auto object-contain"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4 flex-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  color: location.pathname === link.to ? GOLD : "rgba(226,232,245,0.86)",
                  backgroundColor: location.pathname === link.to ? "rgba(201,162,75,0.1)" : "transparent",
                  outlineColor: GOLD,
                }}
              >
                <span style={{ fontFamily: lang === "bn" ? "var(--font-bengali)" : "var(--font-sans)" }}>
                  {lang === "bn" ? link.bn : link.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 ml-auto">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ color: "rgba(226,232,245,0.76)", backgroundColor: "#141830" }}
            >
              <Globe size={13} />
              <span style={{ fontFamily: lang === "bn" ? "var(--font-bengali)" : "var(--font-sans)" }}>
                {lang === "bn" ? "বাং" : "EN"}
              </span>
              <span style={{ color: "rgba(226,232,245,0.50)", margin: "0 1px" }}>·</span>
              <span style={{ fontFamily: lang === "bn" ? "var(--font-sans)" : "var(--font-bengali)" }}>
                {lang === "bn" ? "EN" : "বাং"}
              </span>
            </button>
            <Link
              to="/auth-onboarding"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ color: INK, backgroundColor: "transparent", border: `1px solid ${GOLD}`, fontFamily: lang === "bn" ? "var(--font-bengali)" : "var(--font-sans)" }}
            >
              <span style={{ fontFamily: lang === "bn" ? "var(--font-bengali)" : "var(--font-sans)" }}>
                {lang === "bn" ? "এজেন্ট রেজিস্ট্রেশন" : "Agent Registration"}
              </span>
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ color: INK, backgroundColor: GOLD, fontFamily: lang === "bn" ? "var(--font-bengali)" : "var(--font-sans)" }}
            >
              <span style={{ fontFamily: lang === "bn" ? "var(--font-bengali)" : "var(--font-sans)" }}>
                {lang === "bn" ? "এজেন্ট লগইন" : "Agent Login"}
              </span>
            </Link>
          </div>

          <button
            className="md:hidden ml-auto p-2 rounded-lg"
            style={{ color: "rgba(226,232,245,0.86)" }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t" style={{ borderColor: "rgba(226,232,245,0.11)", backgroundColor: "#0F1326" }}>
            <div className="px-6 py-4 space-y-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-4 py-3 rounded-lg text-sm font-medium"
                  style={{ color: location.pathname === link.to ? GOLD : "rgba(226,232,245,0.86)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t" style={{ borderColor: "rgba(226,232,245,0.11)" }}>
                <Link
                  to="/auth-onboarding"
                  className="block w-full text-center px-4 py-2.5 rounded-lg text-sm font-semibold mt-2"
                  style={{ backgroundColor: "transparent", border: `1px solid ${GOLD}`, color: INK }}
                  onClick={() => setMobileOpen(false)}
                >
                  Agent Registration
                </Link>
                <Link
                  to="/login"
                  className="block w-full text-center px-4 py-2.5 rounded-lg text-sm font-semibold mt-2"
                  style={{ backgroundColor: GOLD, color: INK }}
                  onClick={() => setMobileOpen(false)}
                >
                  Agent Login
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
