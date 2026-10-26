import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/providers/theme-provider";

describe("ThemeToggle", () => {
  it("switches from light to dark, updates the root and persists the choice", async () => {
    const user = userEvent.setup();
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button", { name: /switch to dark theme/i });
    await user.click(button);

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(themeColor.content).toBe("#0f1211");
    expect(window.localStorage.getItem("moneymind-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();

    themeColor.remove();
  });

  it("returns to light mode on a second toggle", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    await user.click(screen.getByRole("button", { name: /switch to light theme/i }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("moneymind-theme")).toBe("light");
  });
});
