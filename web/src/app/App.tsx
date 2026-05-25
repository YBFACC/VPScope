import { useEffect } from "react";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { applyTheme } from "@/theme/applyTheme";
import { getThemeById } from "@/theme/presets";

export function App() {
  useEffect(() => {
    applyTheme(getThemeById(localStorage.getItem("vpscope-theme")));
  }, []);

  return (
    <>
      <DashboardPage />
      <SettingsPage />
    </>
  );
}
