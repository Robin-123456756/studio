// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerCard, type Player } from "./player-card";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "John Smith",
    position: "Midfielder",
    points: 42,
    price: 7.5,
    ...overrides,
  };
}

describe("PlayerCard", () => {
  // ── Basic rendering ──

  it("renders player name and position", () => {
    render(<PlayerCard player={makePlayer()} />);
    expect(screen.getByText(/John Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Midfielder/)).toBeInTheDocument();
  });

  it("renders price formatted as UGX", () => {
    render(<PlayerCard player={makePlayer({ price: 7.5 })} />);
    expect(screen.getByText("UGX 7.5m")).toBeInTheDocument();
  });

  it("renders points", () => {
    render(<PlayerCard player={makePlayer({ points: 42 })} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it('renders "UGX --" for null price', () => {
    render(<PlayerCard player={makePlayer({ price: null as unknown as number })} />);
    expect(screen.getByText("UGX --")).toBeInTheDocument();
  });

  // ── Lady player badge ──

  it("shows Lady badge for lady players", () => {
    render(<PlayerCard player={makePlayer({ isLady: true })} />);
    expect(screen.getByText("• Lady")).toBeInTheDocument();
  });

  it("does not show Lady badge for non-lady players", () => {
    render(<PlayerCard player={makePlayer({ isLady: false })} />);
    expect(screen.queryByText("• Lady")).not.toBeInTheDocument();
  });

  // ── Team display ──

  it("shows teamName when available", () => {
    render(<PlayerCard player={makePlayer({ teamName: "Basunzi FC" })} />);
    expect(screen.getByText(/Basunzi FC/)).toBeInTheDocument();
  });

  it("falls back to teamShort when teamName is null", () => {
    render(<PlayerCard player={makePlayer({ teamName: null, teamShort: "BAS" })} />);
    expect(screen.getByText(/BAS/)).toBeInTheDocument();
  });

  it('shows "--" when both team identifiers are null', () => {
    render(<PlayerCard player={makePlayer({ teamName: null, teamShort: null })} />);
    expect(screen.getByText(/--/)).toBeInTheDocument();
  });

  // ── Avatar ──

  it("renders avatar image when URL is provided", () => {
    render(<PlayerCard player={makePlayer({ avatarUrl: "/avatar.png" })} />);
    const img = screen.getByAltText("John Smith");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/avatar.png");
  });

  it("renders empty circle when no avatar", () => {
    const { container } = render(<PlayerCard player={makePlayer({ avatarUrl: null })} />);
    expect(container.querySelector("img")).toBeNull();
  });

  // ── Ownership ──

  it("shows ownership percentage when > 0", () => {
    render(<PlayerCard player={makePlayer({ ownership: 45 })} />);
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("Sel")).toBeInTheDocument();
  });

  it("hides ownership when null or 0", () => {
    render(<PlayerCard player={makePlayer({ ownership: 0 })} />);
    expect(screen.queryByText("Sel")).not.toBeInTheDocument();

    render(<PlayerCard player={makePlayer({ ownership: null })} />);
    expect(screen.queryByText("Sel")).not.toBeInTheDocument();
  });

  // ── Click interaction ──

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<PlayerCard player={makePlayer()} onClick={onClick} />);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<PlayerCard player={makePlayer()} onClick={onClick} disabled />);

    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("button has disabled attribute when disabled", () => {
    render(<PlayerCard player={makePlayer()} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  // ── Variants ──

  it("applies red border class for 'out' variant when active", () => {
    const { container } = render(
      <PlayerCard player={makePlayer()} variant="out" active />
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-red-500");
  });

  it("applies emerald border class for 'in' variant when active", () => {
    const { container } = render(
      <PlayerCard player={makePlayer()} variant="in" active />
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-emerald-600");
  });

  it("does not apply variant border when not active", () => {
    const { container } = render(
      <PlayerCard player={makePlayer()} variant="out" active={false} />
    );
    const button = container.querySelector("button");
    expect(button?.className).not.toContain("border-red-500");
  });
});
