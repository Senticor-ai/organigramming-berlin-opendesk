import { render } from "@testing-library/react";

jest.mock("./components/Chart/Chart", () => {
  const React = require("react");

  return React.forwardRef(() =>
    React.createElement("div", { "data-testid": "mock-chart" })
  );
});

jest.mock("./components/Sidebar/Sidebar", () => {
  const React = require("react");

  return React.forwardRef(() =>
    React.createElement("div", { "data-testid": "mock-sidebar" })
  );
});

jest.mock("./components/Sidebar/AlertModal", () => {
  const React = require("react");

  return ({ children, show }) =>
    show ? React.createElement("div", null, children) : null;
});

jest.mock("./lib/getJoyrideSettings", () => ({
  getJoyrideSettings: () => ({
    run: false,
    stepIndex: 0,
    steps: [],
  }),
}));

import App from "./App";

test("renders the application shell", () => {
  render(<App />);
  expect(document.querySelector(".App")).not.toBeNull();
});
