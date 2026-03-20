// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import { LaunchGate } from "./launch-gate";

// Mock AppLoading
vi.mock("@/components/app-loading", () => ({
  AppLoading: () => <div data-testid="app-loading">Loading...</div>,
}));

/** Set up window.matchMedia to return standalone or not */
function setupMatchMedia(isStandalone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: isStandalone,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe("LaunchGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: browser mode (not standalone)
    setupMatchMedia(false);
    // Clear navigator.standalone
    Object.defineProperty(window.navigator, "standalone", {
      writable: true,
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Browser mode (not PWA) ──

  it("shows children immediately in browser mode (not standalone)", () => {
    render(
      <LaunchGate>
        <div>App Content</div>
      </LaunchGate>
    );

    expect(screen.getByText("App Content")).toBeInTheDocument();
  });

  it("applies is-ready class immediately in browser mode", () => {
    const { container } = render(
      <LaunchGate>
        <div>App Content</div>
      </LaunchGate>
    );

    const content = container.querySelector(".launch-content");
    expect(content?.className).toContain("is-ready");
  });

  // ── PWA mode (standalone) ──

  it("does not apply is-ready initially in standalone mode", () => {
    setupMatchMedia(true);

    const { container } = render(
      <LaunchGate minDurationMs={5000}>
        <div>App Content</div>
      </LaunchGate>
    );

    const content = container.querySelector(".launch-content");
    expect(content?.className).not.toContain("is-ready");
  });

  it("shows children after minDuration in standalone mode", () => {
    setupMatchMedia(true);

    const { container } = render(
      <LaunchGate minDurationMs={5000}>
        <div>App Content</div>
      </LaunchGate>
    );

    // Before timer
    let content = container.querySelector(".launch-content");
    expect(content?.className).not.toContain("is-ready");

    // After timer
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    content = container.querySelector(".launch-content");
    expect(content?.className).toContain("is-ready");
  });

  it("does not show is-ready before timer completes", () => {
    setupMatchMedia(true);

    const { container } = render(
      <LaunchGate minDurationMs={8000}>
        <div>App Content</div>
      </LaunchGate>
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    const content = container.querySelector(".launch-content");
    expect(content?.className).not.toContain("is-ready");
  });

  it("uses 1500ms default duration", () => {
    setupMatchMedia(true);

    const { container } = render(
      <LaunchGate>
        <div>App Content</div>
      </LaunchGate>
    );

    // At 1499ms — still not ready
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    let content = container.querySelector(".launch-content");
    expect(content?.className).not.toContain("is-ready");

    // At 1500ms — ready
    act(() => {
      vi.advanceTimersByTime(1);
    });
    content = container.querySelector(".launch-content");
    expect(content?.className).toContain("is-ready");
  });

  // ── Structure ──

  it("always renders both loader and content divs", () => {
    const { container } = render(
      <LaunchGate>
        <div>App Content</div>
      </LaunchGate>
    );

    expect(container.querySelector(".launch-gate")).toBeInTheDocument();
    expect(container.querySelector(".launch-loader")).toBeInTheDocument();
    expect(container.querySelector(".launch-content")).toBeInTheDocument();
  });

  it("renders AppLoading inside the loader", () => {
    render(
      <LaunchGate>
        <div>App Content</div>
      </LaunchGate>
    );

    expect(screen.getByTestId("app-loading")).toBeInTheDocument();
  });
});
