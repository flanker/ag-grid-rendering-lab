export async function contentCoverage(page) {
  return page.evaluate(() => {
    const lab = window.__LAB__;
    const viewport = document.querySelector(".ag-grid-viewport");
    const bounds = viewport.getBoundingClientRect();
    const top = viewport.scrollTop;
    const left = viewport.scrollLeft;
    const first = Math.max(0, Math.floor(top / 40));
    const bodyTop = bounds.y + 40;
    const last = Math.min(
      lab.api.getDisplayedRowCount() - 1,
      Math.ceil((top + viewport.clientHeight - 40) / 40) - 1,
    );
    const pinnedWidth = lab.api
      .getAllDisplayedColumns()
      .filter((column) => column.getPinned())
      .reduce((sum, column) => sum + column.getActualWidth(), 0);
    const columns = lab.api.getAllDisplayedColumns().filter((column) => {
      if (column.getPinned()) return true;
      const x = column.getLeft();
      return (
        x < left + viewport.clientWidth - pinnedWidth &&
        x + column.getActualWidth() > left
      );
    });
    const missing = [],
      wrong = [],
      hidden = [],
      misplaced = [];
    let expected = 0;
    for (let index = first; index <= last; index++) {
      const row = lab.api.getDisplayedRowAtIndex(index);
      for (const column of columns) {
        expected++;
        const col = column.getColId();
        const identity = `${row.id}:${col}`;
        const element = document.querySelector(
          `[data-content-id="${identity}"]`,
        );
        if (!element) {
          missing.push(identity);
          continue;
        }
        if (
          element.closest(".ag-row")?.getAttribute("row-id") !== row.id ||
          element.closest(".ag-cell")?.getAttribute("col-id") !== col
        )
          misplaced.push(identity);
        if (
          element.dataset.value !== lab.expected(row.id, col) ||
          element.textContent !== lab.expectedText(row.id, col)
        )
          wrong.push(identity);
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const cellRect = element.closest(".ag-cell").getBoundingClientRect();
        if (
          !element.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          }) ||
          style.visibility === "hidden" ||
          rect.right <= cellRect.left ||
          rect.left >= cellRect.right ||
          rect.bottom <= cellRect.top ||
          rect.top >= cellRect.bottom ||
          cellRect.right <= bounds.x ||
          cellRect.left >= bounds.right ||
          cellRect.bottom <= bodyTop ||
          cellRect.top >= bounds.bottom
        )
          hidden.push(identity);
      }
    }
    return {
      observedAtMs: Date.now(),
      expected,
      missing,
      wrong,
      hidden,
      misplaced,
      complete:
        expected > 0 &&
        !missing.length &&
        !wrong.length &&
        !hidden.length &&
        !misplaced.length,
      top,
      left,
      pageScrollY: scrollY,
      bounds: {
        x: bounds.x,
        y: bodyTop,
        width: bounds.width,
        height: bounds.height - 40,
      },
    };
  });
}
