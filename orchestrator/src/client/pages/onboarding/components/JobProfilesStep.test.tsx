import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobProfilesStep } from "./JobProfilesStep";

describe("JobProfilesStep", () => {
  it("saves generic job-platform profile links without hard-coded providers", () => {
    const onSave = vi.fn();
    render(
      <JobProfilesStep
        initialUrls={[]}
        busy={false}
        onBack={vi.fn()}
        onSave={onSave}
      />,
    );

    const first = screen.getByRole("textbox");
    fireEvent.change(first, {
      target: { value: "https://jobs.example.com/profile/dmitrii" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and finish" }));

    expect(onSave).toHaveBeenCalledWith([
      "https://jobs.example.com/profile/dmitrii",
    ]);
    expect(screen.queryByText("LinkedIn")).not.toBeInTheDocument();
    expect(screen.queryByText("Indeed")).not.toBeInTheDocument();
  });

  it("limits the onboarding step to six profile links", () => {
    render(
      <JobProfilesStep
        initialUrls={[]}
        busy={false}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    for (let index = 1; index < 6; index += 1) {
      fireEvent.click(
        screen.getByRole("button", { name: "Add another link" }),
      );
    }

    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(
      screen.queryByRole("button", { name: "Add another link" }),
    ).not.toBeInTheDocument();
  });

  it("allows the optional step to be skipped", () => {
    const onSave = vi.fn();
    render(
      <JobProfilesStep
        initialUrls={[]}
        busy={false}
        onBack={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(onSave).toHaveBeenCalledWith([]);
  });
});
