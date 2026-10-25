import { describe, expect, it } from "vitest";
import { createPageRequest, MAX_PAGE_SIZE, toPagedResult } from "../../../src/application/common/paging.js";

describe("createPageRequest", () => {
  it.each([
    [0, 20, 1, 20],
    [-5, 20, 1, 20],
    [3, 0, 3, 1],
    [2, 500, 2, MAX_PAGE_SIZE],
    [Number.NaN, Number.NaN, 1, 20],
    [2.7, 10.2, 2, 10],
  ])("clamps page %s / size %s to %s / %s", (page, size, expectedPage, expectedSize) => {
    const request = createPageRequest(page, size);
    expect(request.page).toBe(expectedPage);
    expect(request.pageSize).toBe(expectedSize);
  });

  it("derives skip from page and size", () => {
    expect(createPageRequest(3, 25).skip).toBe(50);
  });
});

describe("toPagedResult", () => {
  it.each([
    [0, 0, false],
    [20, 1, false],
    [21, 2, true],
  ])("with %s items has %s pages (next page: %s)", (total, pages, hasNext) => {
    const result = toPagedResult([], createPageRequest(1, 20), total);
    expect(result.totalPages).toBe(pages);
    expect(result.hasNextPage).toBe(hasNext);
  });
});
