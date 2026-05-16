export const themeInitScript = () => {
  try {
    const storedTheme = window.localStorage.getItem("marketing-theme");

    if (storedTheme === "light" || storedTheme === "dark") {
      document.documentElement.dataset.theme = storedTheme;
      document.documentElement.style.colorScheme = storedTheme;
    }
  } catch {}
}
