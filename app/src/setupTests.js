// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock("@uiw/react-md-editor", () => {
  const React = require("react");

  const MockEditor = ({ value, children }) =>
    React.createElement(
      "div",
      { "data-testid": "mock-md-editor" },
      children || value || ""
    );

  MockEditor.Markdown = ({ source, children }) =>
    React.createElement(
      "div",
      { "data-testid": "mock-md-markdown" },
      children || source || ""
    );

  return {
    __esModule: true,
    default: MockEditor,
    commands: {},
  };
});

jest.mock("rehype-sanitize", () => ({
  __esModule: true,
  default: () => undefined,
}));
