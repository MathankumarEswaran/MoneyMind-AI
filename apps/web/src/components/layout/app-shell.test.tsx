import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/providers/theme-provider";

function renderShell() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AppShell>
          <p>Dashboard content</p>
        </AppShell>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AppShell mobile navigation", () => {
  it("traps focus, closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    renderShell();

    const trigger = screen.getByRole("button", { name: /open navigation/i });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /navigation/i });
    const closeButton = screen.getByRole("button", { name: /close navigation/i });

    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    await user.tab({ shift: true });
    expect(document.activeElement).not.toBe(closeButton);
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /navigation/i })).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });
});
