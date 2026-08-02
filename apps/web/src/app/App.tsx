import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./routes";
import { LangProvider } from "./lib/LangContext";

export default function App() {
  return (
    <LangProvider>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
        position="bottom-right"
        gap={8}
        toastOptions={{
          style: {
            background: "#0D1E3A",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
          },
        }}
      />
    </LangProvider>
  );
}
