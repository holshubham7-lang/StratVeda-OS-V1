"use client";

import { useEffect, useState } from "react";

const WELCOME_NAME_KEY = "stratvedaWelcomeName";

export function saveWelcomeName(name: string) {
  window.sessionStorage.setItem(WELCOME_NAME_KEY, name.trim());
}

export function WelcomeGreeting() {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(window.sessionStorage.getItem(WELCOME_NAME_KEY) ?? "");
  }, []);

  if (!name) return null;

  return <p className="welcome-greeting">Welcome, {name}</p>;
}
