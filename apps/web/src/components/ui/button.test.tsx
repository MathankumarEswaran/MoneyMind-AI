import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import NotFoundPage from "@/pages/not-found";

describe("Button", () => {
  it("renders a native button with accessible content", () => {
    render(<Button variant="outline">Save changes</Button>);

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("border-border");
  });

  it("composes with a link through asChild", () => {
    render(
      <MemoryRouter>
        <Button asChild>
          <a href="/dashboard">Open dashboard</a>
        </Button>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Open dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});

describe("NotFoundPage", () => {
  it("offers clear routes back into the product", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/lost/i);
    expect(screen.getByRole("link", { name: /back home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /open dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});
