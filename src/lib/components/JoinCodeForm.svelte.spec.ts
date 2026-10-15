import { beforeEach, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import JoinCodeForm from "./JoinCodeForm.svelte";

// `use:enhance` needs a SvelteKit app around it; typing doesn't.
vi.mock("$app/forms", () => ({ enhance: () => ({}) }));

// Filling the last box submits the form. Count submits instead of letting
// them reload the test page.
const submitted = vi.fn((event: SubmitEvent) => {
  event.preventDefault();
});
document.addEventListener("submit", submitted);
beforeEach(() => {
  submitted.mockClear();
});

it("keeps only what can be in a code, uppercased, six at most", async () => {
  await render(JoinCodeForm, {});
  const input = page.getByLabelText("Invite code");

  await userEvent.click(input);
  // 0, O, 1, I, L and punctuation never appear in codes.
  await userEvent.keyboard("k7q-0o1il m2x");
  await expect.element(input).toHaveValue("K7QM2X");
  // Once full, typing replaces the last box instead of growing the code.
  await userEvent.keyboard("9");
  await expect.element(input).toHaveValue("K7QM29");
  // Submitted once, when the sixth character landed.
  expect(submitted).toHaveBeenCalledOnce();
});

it("cleans up a pasted code", async () => {
  await render(JoinCodeForm, {});
  const input = page.getByLabelText("Invite code");
  await userEvent.click(input);
  // A real paste event, like a long-press Paste on a phone.
  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", " k7q-m2x ");
  input
    .element()
    .dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, cancelable: true })
    );
  await expect.element(input).toHaveValue("K7QM2X");
});

it("shows the error next to the field", async () => {
  await render(JoinCodeForm, { error: "That's not an active invite code." });
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("That's not an active invite code.");
  await expect
    .element(page.getByLabelText("Invite code"))
    .toHaveAttribute("aria-invalid", "true");
});
