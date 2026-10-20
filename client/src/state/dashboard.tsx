import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ALSWEED_PROFILE } from "@/lib/presets";
import type {
  ApiExchange,
  ApiResult,
  BusinessProfile,
  Connection,
  RuntimeStatus,
} from "@/lib/types";

const CONNECTION_KEY = "mba.connection.v1";
const PROFILE_KEY = "mba.profile.v1";
const LOG_KEY = "mba.log.v1";
const STATUS_KEY = "mba.status.v1";

export const emptyConnection = (): Connection => ({
  businessPortfolioId: "",
  wabaId: "",
  phoneNumberId: "",
  accessToken: "",
  appId: "",
  accountMode: "cloud_api",
  billableAccountId: "",
});

const emptyStatus = (): RuntimeStatus => ({
  eligible: null,
  agentId: null,
  rolloutEnabled: null,
  audience: null,
  uiSkillAccepted: false,
  documentedCost: null,
});

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

type DashboardValue = {
  connection: Connection;
  setConnection: (next: Connection) => void;
  saveConnection: () => void;
  profile: BusinessProfile;
  setProfile: (next: BusinessProfile) => void;
  status: RuntimeStatus;
  setStatus: (patch: Partial<RuntimeStatus>) => void;
  exchanges: ApiExchange[];
  clearLog: () => void;
  run: <T>(result: Promise<ApiResult<T>>) => Promise<ApiResult<T>>;
  pushExchange: (exchange: ApiExchange) => void;
  busy: boolean;
};

const DashboardContext = createContext<DashboardValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [connection, setConnectionState] = useState<Connection>(() =>
    readJson(CONNECTION_KEY, emptyConnection()),
  );
  const [profile, setProfileState] = useState<BusinessProfile>(() =>
    readJson(PROFILE_KEY, ALSWEED_PROFILE),
  );
  const [status, setStatusState] = useState<RuntimeStatus>(() =>
    readJson(STATUS_KEY, emptyStatus()),
  );
  const [exchanges, setExchanges] = useState<ApiExchange[]>(() => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? (JSON.parse(raw) as ApiExchange[]) : [];
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);

  const setConnection = useCallback((next: Connection) => {
    setConnectionState(next);
  }, []);

  const saveConnection = useCallback(() => {
    localStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
  }, [connection]);

  const setProfile = useCallback((next: BusinessProfile) => {
    setProfileState(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  }, []);

  const setStatus = useCallback((patch: Partial<RuntimeStatus>) => {
    setStatusState((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(STATUS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const pushExchange = useCallback((exchange: ApiExchange) => {
    setExchanges((current) => {
      const next = [exchange, ...current].slice(0, 300);
      localStorage.setItem(LOG_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearLog = useCallback(() => {
    setExchanges([]);
    localStorage.removeItem(LOG_KEY);
  }, []);

  const run = useCallback(
    async <T,>(result: Promise<ApiResult<T>>) => {
      setBusy(true);
      try {
        const settled = await result;
        pushExchange(settled.exchange);
        return settled;
      } finally {
        setBusy(false);
      }
    },
    [pushExchange],
  );

  const value = useMemo(
    () => ({
      connection,
      setConnection,
      saveConnection,
      profile,
      setProfile,
      status,
      setStatus,
      exchanges,
      clearLog,
      run,
      pushExchange,
      busy,
    }),
    [
      connection,
      setConnection,
      saveConnection,
      profile,
      setProfile,
      status,
      setStatus,
      exchanges,
      clearLog,
      run,
      pushExchange,
      busy,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("DashboardProvider missing");
  return value;
}
