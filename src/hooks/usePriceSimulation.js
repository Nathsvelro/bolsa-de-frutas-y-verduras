import { useCallback, useEffect, useRef, useState } from "react";
import { generateInitialDataset, simulateTick } from "../data/mockData";

const STORAGE_KEY = "bolsa-de-verduras:dataset";
const TICK_MS = 4500;

function loadStoredDataset() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.products?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function usePriceSimulation() {
  const [dataset, setDataset] = useState(() => loadStoredDataset() || generateInitialDataset());
  const [notifications, setNotifications] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      // almacenamiento no disponible (modo privado, cuota llena, etc.)
    }
  }, [dataset]);

  const tick = useCallback(() => {
    setDataset((current) => {
      const { dataset: next, notifications: newNotifications } = simulateTick(current);
      if (newNotifications.length) {
        setNotifications((prev) => [...newNotifications, ...prev].slice(0, 6));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isLive) return undefined;
    intervalRef.current = setInterval(tick, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [isLive, tick]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const reset = useCallback(() => {
    const fresh = generateInitialDataset();
    setDataset(fresh);
    setNotifications([]);
  }, []);

  return {
    products: dataset.products,
    updatedAt: dataset.updatedAt,
    isLive,
    setIsLive,
    notifications,
    dismissNotification,
    forceTick: tick,
    reset,
  };
}
