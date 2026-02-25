"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type OrgContextType = {
  orgId: number | null;
  setOrgId: (id: number | null) => void;
};

const OrgContext = createContext<OrgContextType | undefined>(undefined);

function getInitialOrgId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("selectedOrgId");
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgId, setOrgIdState] = useState<number | null>(getInitialOrgId);

  const setOrgId = (id: number | null) => {
    setOrgIdState(id);
    if (id) {
      localStorage.setItem("selectedOrgId", id.toString());
    } else {
      localStorage.removeItem("selectedOrgId");
    }
  };

  return (
    <OrgContext.Provider value={{ orgId, setOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within OrgProvider");
  }
  return context;
}
