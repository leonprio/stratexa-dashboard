import { scrollToTop, scrollToElementBelowHeader, scheduleScroll } from "./scrollUtils";

describe("scrollUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = jest.fn();
    window.requestAnimationFrame = jest.fn((cb) => {
      cb(0);
      return 0;
    });
  });

  test("scrollToTop ejecuta window.scrollTo con top: 0 y behavior auto", () => {
    scrollToTop();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  test("scrollToElementBelowHeader calcula el offset del header y posiciona window.scrollTo con behavior auto", () => {
    const headerEl = document.createElement("header");
    Object.defineProperty(headerEl, "getBoundingClientRect", {
      value: () => ({ height: 80 }),
    });
    document.body.appendChild(headerEl);

    const targetEl = document.createElement("div");
    targetEl.id = "target-test";
    Object.defineProperty(targetEl, "getBoundingClientRect", {
      value: () => ({ top: 300 }),
    });
    document.body.appendChild(targetEl);

    scrollToElementBelowHeader("target-test", "header");

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 220, behavior: "auto" });

    document.body.removeChild(headerEl);
    document.body.removeChild(targetEl);
  });

  test("scheduleScroll ejecuta la función dentro de requestAnimationFrame", () => {
    const fn = jest.fn();
    scheduleScroll(fn);
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    expect(fn).toHaveBeenCalled();
  });
});
