import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export function useClubNavigation() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const more = useRef<HTMLDetailsElement>(null);
  const close = () => {
    setOpen(false);
    if (more.current) more.current.open = false;
  };
  useEffect(() => {
    close();
  }, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        (more.current?.open ||
          header.current?.querySelector('[aria-expanded="true"]'))
      ) {
        const toggle = header.current?.querySelector<HTMLButtonElement>(
          '[aria-controls="club-navigation-links"]',
        );
        const target =
          toggle?.getAttribute("aria-expanded") === "true"
            ? toggle
            : more.current?.querySelector<HTMLElement>("summary");
        close();
        target?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return { open, setOpen, header, more, close };
}
