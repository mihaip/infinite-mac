import React from "react";
import {render, screen} from "@testing-library/react";
import App from "./App";

test("renders something", () => {
    render(<App />);
    const titleElement = screen.getByText(/Infinite Mac/i);
    expect(titleElement).toBeInTheDocument();
});
