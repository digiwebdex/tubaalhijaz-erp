import { extract } from "./parsers";
import type { OcrResult } from "./vision.client";

describe("T001-07 Nusuk Group List parser", () => {
  it("extracts from structured provider fields", () => {
    const ocr: OcrResult = {
      fullText: "",
      words: [],
      meanConfidence: 0.9,
      provider: "stub",
      structured: {
        nusukGroupNumber: "NUSUK-998877",
        groupName: "Bengal United",
        consulate: "Dhaka",
        paxCount: "42",
        agentCode: "1004492",
        departDate: "2026-09-01",
        returnDate: "2026-09-20",
      },
    };
    const ex = extract("NUSUK_GROUP_LIST", ocr);
    const map = Object.fromEntries(ex.fields.map((f) => [f.field, f.value]));
    expect(map.nusukGroupNumber).toBe("NUSUK-998877");
    expect(map.groupName).toBe("Bengal United");
    expect(map.consulate).toBe("Dhaka");
    expect(map.paxCount).toBe("42");
    expect(map.agentCode).toBe("1004492");
    expect(ex.meta.nusukGroupList).toBe(true);
  });

  it("falls back to labelled fullText heuristics", () => {
    const ocr: OcrResult = {
      fullText: [
        "Group Number: GRP-445566",
        "Group Name: Al Noor Party",
        "Consulate: Jeddah",
        "Pax: 30 pilgrims",
        "Agent Code: EA-77",
      ].join("\n"),
      words: [],
      meanConfidence: 0.85,
      provider: "stub",
    };
    const ex = extract("NUSUK_GROUP_LIST", ocr);
    const map = Object.fromEntries(ex.fields.map((f) => [f.field, f.value]));
    expect(map.nusukGroupNumber).toBe("GRP-445566");
    expect(map.groupName).toBe("Al Noor Party");
    expect(map.consulate).toBe("Jeddah");
    expect(map.agentCode).toBe("EA-77");
  });

  it("passport path unchanged", () => {
    const ocr: OcrResult = {
      fullText: "PASSPORT",
      words: [],
      meanConfidence: 0.9,
      provider: "stub",
      structured: {
        name: "A B",
        passportNo: "P1",
        nationality: "BGD",
        dob: "1990-01-01",
        sex: "M",
        passportExpiry: "2030-01-01",
        issuingCountry: "BGD",
        personalNumber: null,
      },
    };
    const ex = extract("PASSPORT", ocr);
    expect(ex.fields.some((f) => f.field === "passportNo")).toBe(true);
    expect(ex.fields.some((f) => f.field === "nusukGroupNumber")).toBe(false);
  });
});
