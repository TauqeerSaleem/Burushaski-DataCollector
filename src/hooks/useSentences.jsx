import yasin from "../data/sentences_yasin.json";
import hunza from "../data/sentences_hunza.json";
import { useUser } from "../context/UserContext";
import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

export function useSentences() {
  const { user } = useUser();
  const fallbackData = user?.dialect === "yasin" ? yasin : hunza;
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setData(null);
      return () => {
        cancelled = true;
      };
    }

    const loadPrompts = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/prompts?dialect=${encodeURIComponent(user.dialect || "")}`
        );

        if (!response.ok) throw new Error("Prompt bank unavailable.");

        const promptData = await response.json();

        if (!cancelled && promptData?.modules?.length > 0) {
          setData(promptData);
          return;
        }
      } catch (error) {
        console.info("Using bundled prompts:", error.message);
      }

      if (!cancelled) {
        setData(fallbackData);
      }
    };

    loadPrompts();

    return () => {
      cancelled = true;
    };
  }, [fallbackData, user]);

  return data;
}
