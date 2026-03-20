// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamNameModal } from "./TeamNameModal";

// Mock the DB call
const mockUpsert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/fantasyDb", () => ({
  upsertTeamName: (...args: unknown[]) => mockUpsert(...args),
}));

describe("TeamNameModal", () => {
  const onSaved = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue(undefined);
  });

  function renderModal(props: Partial<Parameters<typeof TeamNameModal>[0]> = {}) {
    return render(
      <TeamNameModal
        open={true}
        onSaved={onSaved}
        {...props}
      />
    );
  }

  // ── Rendering ──

  it("renders the modal when open", () => {
    renderModal();
    expect(screen.getByText("Name Your Team")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Kampala United FC")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByText("Name Your Team")).not.toBeInTheDocument();
  });

  // ── Validation ──

  it("disables submit button when input is empty", () => {
    renderModal();
    const button = screen.getByRole("button", { name: /continue/i });
    expect(button).toBeDisabled();
  });

  it("disables submit when name is too short (1 char)", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "A");

    const button = screen.getByRole("button", { name: /continue/i });
    expect(button).toBeDisabled();
    expect(screen.getByText("Name must be at least 2 characters")).toBeInTheDocument();
  });

  it("enables submit when name is valid (2+ chars)", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "FC Budo");

    const button = screen.getByRole("button", { name: /continue/i });
    expect(button).toBeEnabled();
  });

  it("rejects whitespace-only input", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "   ");

    const button = screen.getByRole("button", { name: /continue/i });
    expect(button).toBeDisabled();
  });

  // ── Submission ──

  it("calls upsertTeamName and onSaved on valid submit", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "FC Budo");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith("FC Budo");
      expect(onSaved).toHaveBeenCalledWith("FC Budo");
    });
  });

  it("trims whitespace before saving", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "  FC Budo  ");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith("FC Budo");
    });
  });

  it("submits on Enter key", async () => {
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByPlaceholderText("e.g. Kampala United FC");
    await user.type(input, "FC Budo{Enter}");

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith("FC Budo");
    });
  });

  it("shows loading state during save", async () => {
    // Make upsert hang
    mockUpsert.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "FC Budo");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  // ── Error handling ──

  it("displays error message when save fails", async () => {
    mockUpsert.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "FC Budo");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    // onSaved should NOT be called on error
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows generic error when error has no message", async () => {
    mockUpsert.mockRejectedValue({});
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("e.g. Kampala United FC"), "FC Budo");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText("Failed to save team name")).toBeInTheDocument();
    });
  });

  // ── Edit mode (dismissible) ──

  it("pre-fills input with initialValue", () => {
    renderModal({ initialValue: "Old Name" });
    const input = screen.getByPlaceholderText("e.g. Kampala United FC") as HTMLInputElement;
    expect(input.value).toBe("Old Name");
  });

  // ── Non-dismissible gate (critical business rule) ──

  it("renders the input element for team name entry", () => {
    renderModal();
    const input = screen.getByPlaceholderText("e.g. Kampala United FC");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("type", "text");
  });
});
