import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Card } from "./Card";

it("reserves default hover feedback for actionable cards and preserves an explicit opt-out", () => {
  render(<>
    <Card>Static information</Card>
    <Card clickable>Actionable information</Card>
    <Card clickable hover={false}>Custom action</Card>
  </>);
  expect(screen.getByText("Static information")).not.toHaveClass("hover:shadow-card-hover");
  expect(screen.getByText("Actionable information"))
    .toHaveClass("cursor-pointer", "hover:shadow-card-hover");
  expect(screen.getByText("Custom action")).not.toHaveClass("hover:shadow-card-hover");
  expect(screen.getByText("Custom action")).toHaveClass("cursor-pointer");
});
