/**
 * UI-04 — standard toast helpers over existing `sonner`.
 * Do not invent a second toast system.
 */
import { toast } from "sonner";

export const erpToast = {
  success(message: string, lang: "bn" | "en" = "bn") {
    return toast.success(message || (lang === "bn" ? "সফল হয়েছে" : "Success"), { duration: 2500 });
  },
  error(message: string, lang: "bn" | "en" = "bn") {
    return toast.error(message || (lang === "bn" ? "কিছু ভুল হয়েছে" : "Something went wrong"), {
      duration: 3500,
    });
  },
  info(message: string) {
    return toast.info(message, { duration: 2500 });
  },
  loading(message: string, lang: "bn" | "en" = "bn") {
    return toast.loading(message || (lang === "bn" ? "অপেক্ষা করুন…" : "Please wait…"));
  },
};
