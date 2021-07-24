import React from "react";
import {render, screen} from "@testing-library/react";
import App from "./App";

test("renders something", () => {
    render(<App />);
    const titleElement = screen.getByText(/Inside Macintosh/i);
    expect(titleElement).toBeInTheDocument();
});
