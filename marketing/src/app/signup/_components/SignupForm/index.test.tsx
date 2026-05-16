// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import SignupForm from ".";

describe("SignupForm", () => {
  it("submits valid form data and shows a success message", async () => {
    const user = userEvent.setup();

    render(<SignupForm />);

    await user.type(screen.getByLabelText("Full name"), "Alex Writer");
    await user.type(screen.getByLabelText("Work email"), "alex@example.com");
    await user.type(screen.getByLabelText("Newsletter or publication name"), "Signals Weekly");
    await user.selectOptions(screen.getByLabelText("Plan interest"), "hosted");
    await user.click(screen.getByRole("button", { name: "Request access" }));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});