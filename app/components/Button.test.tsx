import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";

it("preserves explicit form submission while actions and disabled controls do not submit", () => {
  const submit = vi.fn((event) => event.preventDefault());
  const action = vi.fn();
  render(
    <form onSubmit={submit}>
      <Button onClick={action}>Action</Button>
      <Button type="submit">Submit</Button>
      <Button type="submit" disabled aria-busy="true">Saving</Button>
    </form>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Action" }));
  expect(action).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(submit).toHaveBeenCalledOnce();

  const saving = screen.getByRole("button", { name: "Saving" });
  expect(saving).toBeDisabled();
  expect(saving).toHaveAttribute("aria-busy", "true");
  fireEvent.click(saving);
  expect(submit).toHaveBeenCalledOnce();
});
