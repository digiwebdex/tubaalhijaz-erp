// ─── TUBA AL HIJAZ · Bilingual UI Strings ────────────────────────────────────
// Bengali (বাংলা) is the DEFAULT language.
// English is the alternative, toggled via the LangToggle component.
//
// Usage:
//   import { type Lang, t, toLocalNum, localDate } from "../lib/i18n";
//   // In component: pass lang: Lang via props or context
//   <span>{t("dashboard", lang)}</span>
//   <span>{toLocalNum(924, lang)}</span>
//   <span>{localDate(16, 7, 2025, lang)}</span>

export type Lang = "bn" | "en";

// ─── Numeral conversion ───────────────────────────────────────────────────────

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Convert digit characters 0-9 to Bengali numerals ০-৯ when lang = "bn". */
export function toLocalNum(n: string | number, lang: Lang): string {
  if (lang === "en") return String(n);
  return String(n).replace(/[0-9]/g, d => BN_DIGITS[+d]);
}

/** Format a SAR amount with language-appropriate numerals. */
export function localSAR(amount: string | number, lang: Lang): string {
  const str = typeof amount === "number" ? amount.toLocaleString("en-US") : amount;
  return lang === "bn" ? `SAR ${str.replace(/[0-9]/g, d => BN_DIGITS[+d])}` : `SAR ${str}`;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

const BN_MONTHS = [
  "জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন",
  "জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর",
];
const EN_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/** Format a Gregorian date with Bengali or English month names and numerals. */
export function localDate(day: number, month: number, year: number, lang: Lang): string {
  if (lang === "bn") {
    return `${toLocalNum(day, "bn")} ${BN_MONTHS[month - 1]} ${toLocalNum(year, "bn")}`;
  }
  return `${day} ${EN_MONTHS[month - 1]} ${year}`;
}

/** Format a short time string (HH:MM) with language-appropriate numerals. */
export function localTime(hh: number, mm: number, lang: Lang): string {
  const padded = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
  return toLocalNum(padded, lang);
}

// ─── Translation strings ──────────────────────────────────────────────────────
// Add new keys as screens are built. Bengali is always the first value.

export const STRINGS = {
  // ── Module names
  dashboard:        { bn:"ড্যাশবোর্ড",          en:"Dashboard"         },
  ceoDashboard:     { bn:"সিইও ড্যাশবোর্ড",     en:"CEO Dashboard"     },
  opsDashboard:     { bn:"অপারেশন ড্যাশবোর্ড", en:"Ops Dashboard"     },
  finDashboard:     { bn:"অর্থ ড্যাশবোর্ড",     en:"Finance Dashboard" },
  agentPortal:      { bn:"এজেন্ট পোর্টাল",       en:"Agent Portal"      },
  supplierPortal:   { bn:"সরবরাহকারী পোর্টাল",  en:"Supplier Portal"   },
  opsControl:       { bn:"অপারেশন কেন্দ্র",      en:"Ops Control"       },
  financeERP:       { bn:"অর্থ ব্যবস্থাপনা",    en:"Finance ERP"       },
  ocrCenter:        { bn:"ওসিআর কেন্দ্র",        en:"OCR Center"        },
  automation:       { bn:"স্বয়ংক্রিয়করণ",       en:"Automation"        },
  workflowMap:      { bn:"কর্মপ্রবাহ মানচিত্র", en:"Workflow Map"       },
  mobileApps:       { bn:"মোবাইল অ্যাপ",         en:"Mobile Apps"       },
  // ── Sidebar navigation
  groups:           { bn:"গ্রুপ",                en:"Groups"            },
  passengers:       { bn:"যাত্রী",               en:"Passengers"        },
  documents:        { bn:"নথিপত্র",              en:"Documents"         },
  finance:          { bn:"অর্থ",                 en:"Finance"           },
  reports:          { bn:"প্রতিবেদন",            en:"Reports"           },
  settings:         { bn:"সেটিংস",               en:"Settings"          },
  notifications:    { bn:"বিজ্ঞপ্তি",            en:"Notifications"     },
  dispatch:         { bn:"প্রেরণ",               en:"Dispatch"          },
  arrivals:         { bn:"আগমন",                 en:"Arrivals"          },
  departures:       { bn:"প্রস্থান",             en:"Departures"        },
  visa:             { bn:"ভিসা",                  en:"Visa"              },
  hotel:            { bn:"হোটেল",                en:"Hotel"             },
  transport:        { bn:"পরিবহন",               en:"Transport"         },
  catering:         { bn:"খাদ্য সেবা",            en:"Catering"          },
  invoice:          { bn:"চালান",                en:"Invoice"           },
  // ── Action buttons (watch for length! বাংলা ≈ 1.2–1.6× English)
  save:             { bn:"সংরক্ষণ করুন",         en:"Save"              },
  cancel:           { bn:"বাতিল করুন",           en:"Cancel"            },
  submit:           { bn:"জমা দিন",              en:"Submit"            },
  confirm:          { bn:"নিশ্চিত করুন",          en:"Confirm"           },
  approve:          { bn:"অনুমোদন করুন",         en:"Approve"           },
  reject:           { bn:"প্রত্যাখ্যান করুন",    en:"Reject"            },
  delete:           { bn:"মুছে ফেলুন",           en:"Delete"            },
  edit:             { bn:"সম্পাদনা করুন",         en:"Edit"              },
  view:             { bn:"দেখুন",                en:"View"              },
  viewMore:         { bn:"আরও দেখুন",            en:"View More"         },
  download:         { bn:"ডাউনলোড করুন",          en:"Download"          },
  upload:           { bn:"আপলোড করুন",           en:"Upload"            },
  newGroup:         { bn:"নতুন গ্রুপ",            en:"New Group"         },
  addPassenger:     { bn:"যাত্রী যোগ করুন",      en:"Add Passenger"     },
  signIn:           { bn:"লগইন করুন",             en:"Sign In"           },
  signOut:          { bn:"সাইন আউট",              en:"Sign Out"          },
  filter:           { bn:"ফিল্টার",               en:"Filter"            },
  search:           { bn:"অনুসন্ধান করুন",        en:"Search"            },
  scanPassport:     { bn:"পাসপোর্ট স্ক্যান করুন", en:"Scan Passport"    },
  assignDriver:     { bn:"চালক নিয়োগ করুন",      en:"Assign Driver"     },
  sendVouchers:     { bn:"ভাউচার পাঠান",          en:"Send Vouchers"     },
  openMaps:         { bn:"ম্যাপ খুলুন",           en:"Open Maps"         },
  // ── Status badges
  approved:         { bn:"অনুমোদিত",              en:"Approved"          },
  pending:          { bn:"মুলতুবি",               en:"Pending"           },
  inProgress:       { bn:"চলমান",                 en:"In Progress"       },
  completed:        { bn:"সম্পন্ন",               en:"Completed"         },
  cancelled:        { bn:"বাতিল",                 en:"Cancelled"         },
  active:           { bn:"সক্রিয়",               en:"Active"            },
  onDuty:           { bn:"কর্তব্যরত",              en:"On Duty"           },
  archived:         { bn:"সংরক্ষিত",              en:"Archived"          },
  delayed:          { bn:"বিলম্বিত",              en:"Delayed"           },
  urgent:           { bn:"জরুরি",                 en:"Urgent"            },
  atGate:           { bn:"গেটে আছেন",              en:"At Gate"           },
  enRoute:          { bn:"পথে আছেন",               en:"En Route"          },
  inStay:           { bn:"অবস্থানরত",              en:"In Stay"           },
  scheduled:        { bn:"নির্ধারিত",              en:"Scheduled"         },
  // ── Table column headers
  groupId:          { bn:"গ্রুপ আইডি",             en:"Group ID"          },
  agent:            { bn:"এজেন্ট",                  en:"Agent"             },
  pax:              { bn:"যাত্রী",                 en:"Pax"               },
  status:           { bn:"অবস্থা",                  en:"Status"            },
  stage:            { bn:"ধাপ",                    en:"Stage"             },
  actions:          { bn:"কার্যক্রম",               en:"Actions"           },
  flightNo:         { bn:"ফ্লাইট নং",               en:"Flight No."        },
  origin:           { bn:"উৎস",                    en:"Origin"            },
  eta:              { bn:"আগমনের সময়",              en:"ETA"               },
  terminal:         { bn:"টার্মিনাল",               en:"Terminal"          },
  driverId:         { bn:"চালক আইডি",               en:"Driver ID"         },
  route:            { bn:"রুট",                    en:"Route"             },
  // ── Form labels + placeholders
  groupName:        { bn:"গ্রুপের নাম",              en:"Group Name"        },
  enterGroupName:   { bn:"গ্রুপের নাম লিখুন",       en:"Enter group name"  },
  emailAddress:     { bn:"ইমেইল ঠিকানা",            en:"Email Address"     },
  enterEmail:       { bn:"আপনার ইমেইল লিখুন",       en:"Enter your email"  },
  password:         { bn:"পাসওয়ার্ড",               en:"Password"          },
  enterPassword:    { bn:"পাসওয়ার্ড লিখুন",         en:"Enter password"    },
  passport:         { bn:"পাসপোর্ট নম্বর",           en:"Passport Number"   },
  nationality:      { bn:"জাতীয়তা",                 en:"Nationality"       },
  // ── Validation messages
  required:         { bn:"এই তথ্য আবশ্যক",          en:"This field is required" },
  invalidEmail:     { bn:"ইমেইল ঠিকানাটি সঠিক নয়", en:"Invalid email address"  },
  // ── KPI labels
  totalRevenue:     { bn:"মোট আয়",                  en:"Total Revenue"     },
  activePax:        { bn:"সক্রিয় যাত্রী",           en:"Active Pax"        },
  activeGroups:     { bn:"সক্রিয় গ্রুপ",            en:"Active Groups"     },
  netMargin:        { bn:"নিট মার্জিন",              en:"Net Margin"        },
  totalDispatches:  { bn:"মোট প্রেরণ",               en:"Total Dispatches"  },
  ytdRevenue:       { bn:"বার্ষিক আয় (YTD)",        en:"YTD Revenue"       },
  // ── Stepper stage labels (from Workflow Map)
  agentReg:         { bn:"এজেন্ট নিবন্ধন",           en:"Agent Registration" },
  verification:     { bn:"যাচাইকরণ",                en:"Verification"       },
  agentApproval:    { bn:"এজেন্ট অনুমোদন",          en:"Agent Approval"     },
  groupCreate:      { bn:"গ্রুপ তৈরি",              en:"Group Creation"     },
  paxImport:        { bn:"যাত্রী আমদানি",            en:"Pax Import"         },
  flightTicket:     { bn:"টিকিট",                   en:"Flight & Ticket"    },
  visaProc:         { bn:"ভিসা প্রক্রিয়া",           en:"Visa Processing"    },
  hotelBook:        { bn:"হোটেল বুকিং",              en:"Hotel Booking"      },
  // ── Misc UI labels
  lastUpdated:      { bn:"শেষ আপডেট",               en:"Last Updated"       },
  increase:         { bn:"বৃদ্ধি",                  en:"increase"           },
  season:           { bn:"মৌসুম",                   en:"Season"             },
  loading:          { bn:"লোড হচ্ছে...",             en:"Loading..."         },
  noData:           { bn:"কোনো তথ্য নেই",            en:"No data available"  },
  welcomeBack:      { bn:"স্বাগতম",                  en:"Welcome back"       },
  of:               { bn:"এর মধ্যে",                en:"of"                 },
  showing:          { bn:"দেখানো হচ্ছে",             en:"Showing"            },
  today:            { bn:"আজ",                      en:"Today"              },
  total:            { bn:"মোট",                     en:"Total"              },
  // ── Toggle labels (used in LangToggle component)
  langBn:           { bn:"বাং",                     en:"BN"                 },
  langEn:           { bn:"EN",                      en:"EN"                 },
} as const;

export type StringKey = keyof typeof STRINGS;

/** Return the translated string for the given key and language. */
export function t(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang];
}

/** Font family to use for a given language. */
export function fontFor(lang: Lang): string {
  return lang === "bn" ? "var(--font-bengali)" : "var(--font-sans)";
}

/** Line-height recommendation per language.
 *  Bengali requires ~1.75 to accommodate matras + vowel diacritics above the headline.
 *  English body text uses 1.5.
 */
export function lineHeightFor(lang: Lang, level: "body" | "heading" | "display"): number {
  if (lang === "en") return level === "body" ? 1.5 : level === "heading" ? 1.35 : 1.2;
  return level === "body" ? 1.75 : level === "heading" ? 1.6 : 1.45;
}
