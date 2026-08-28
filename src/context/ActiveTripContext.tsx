import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getActiveFolder,
  setActiveFolder,
  clearActiveFolder,
} from "@/services/activeFolderService";

type ActiveTripContextType = {
  activeTripId: string | null;
  loading: boolean;

  selectTrip: (tripId: string) => Promise<void>;
  clearTrip: () => Promise<void>;
};

const ActiveTripContext =
  createContext<ActiveTripContextType | null>(null);

export function ActiveTripProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeTripId, setActiveTripId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveTrip();
  }, []);

  const loadActiveTrip = async () => {
    try {
      const savedTripId = await getActiveFolder();

      setActiveTripId(savedTripId);
    } catch (error) {
      console.error(
        "활성 여행 정보를 불러오지 못했습니다.",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const selectTrip = async (tripId: string) => {
    try {
      await setActiveFolder(tripId);

      setActiveTripId(tripId);
    } catch (error) {
      console.error(
        "활성 여행 변경에 실패했습니다.",
        error
      );
    }
  };

  const clearTrip = async () => {
    try {
      await clearActiveFolder();

      setActiveTripId(null);
    } catch (error) {
      console.error(
        "활성 여행 초기화에 실패했습니다.",
        error
      );
    }
  };

  return (
    <ActiveTripContext.Provider
      value={{
        activeTripId,
        loading,
        selectTrip,
        clearTrip,
      }}
    >
      {children}
    </ActiveTripContext.Provider>
  );
}

export function useActiveTrip() {
  const context = useContext(ActiveTripContext);

  if (!context) {
    throw new Error(
      "useActiveTrip must be used inside ActiveTripProvider"
    );
  }

  return context;
}