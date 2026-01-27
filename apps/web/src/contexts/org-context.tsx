"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type OrgContextType = {
  orgId: number | null;
  setOrgId: (id: number | null) => void;
};

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgId, setOrgIdState] = useState<number | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("selectedOrgId");
    if (stored) {
      try {
        setOrgIdState(parseInt(stored, 10));
      } catch {
        // Invalid stored value
      }
    }
  }, []);

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
